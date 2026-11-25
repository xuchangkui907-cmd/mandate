// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {ITIP20} from "./interfaces/ITIP20.sol";

/// @title MandateBook v2
/// @notice Policy-bound spend authorization on Tempo with enterprise treasury
///         isolation, challenge replay protection, per-tx caps, and RBAC.
contract MandateBook {
    struct Mandate {
        address spender;
        address token;
        uint128 spendMax;
        uint128 remaining;
        uint128 maxPerTx;
        uint64 validAfter;
        uint64 validUntil;
        uint128 rateLimit;
        uint32 window;
        uint128 windowSpent;
        uint64 windowStart;
        bool paused;
        bool closed;
        bytes32 department;
    }

    address public owner;
    address public treasuryAdmin;
    address public emergencyGuardian;
    mapping(address => bool) public policyOperators;
    uint256 public nextId;
    mapping(uint256 => Mandate) public mandates;
    mapping(uint256 => mapping(address => bool)) public allowlisted;
    mapping(uint256 => uint256) public allowlistCount;
    mapping(uint256 => mapping(bytes32 => bool)) public settledMemos;
    mapping(address => uint256) public reservedByToken;
    uint256 private _guard;

    error UnknownMandate();
    error NotOwner();
    error NotTreasuryAdmin();
    error NotPolicyOperator();
    error NotGuardianOrOperator();
    error NotSpender();
    error ZeroAddress();
    error MandatePaused();
    error MandateClosed();
    error MandateNotYetValid();
    error MandateExpired();
    error MerchantNotAllowed();
    error CapExceeded();
    error PerTxLimitExceeded();
    error RateLimited();
    error ChallengeAlreadySettled();
    error InsufficientTreasury();
    error ExceedsUnencumberedBalance();
    error ZeroAmount();
    error InvalidWindow();
    error InvalidSpendMax();
    error InvalidValidityRange();

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event TreasuryAdminSet(address indexed admin);
    event EmergencyGuardianSet(address indexed guardian);
    event PolicyOperatorSet(address indexed operator, bool enabled);

    event Issued(
        uint256 indexed id,
        address indexed spender,
        address indexed token,
        uint128 spendMax,
        uint128 maxPerTx,
        uint64 validAfter,
        uint64 validUntil,
        uint128 rateLimit,
        uint32 window,
        bytes32 department
    );
    event ToppedUp(uint256 indexed id, uint128 addedAmount, uint128 newRemaining);
    event MerchantSet(uint256 indexed id, address indexed merchant, bool allowed);
    event Paused(uint256 indexed id, bool paused, address indexed actor);
    event Closed(uint256 indexed id, uint128 releasedAmount);
    event Paid(
        uint256 indexed id,
        address indexed spender,
        address indexed merchant,
        address token,
        uint128 amount,
        bytes32 memo,
        uint128 remaining
    );
    event Deposited(address indexed token, uint256 amount, address indexed from);
    event Withdrawn(address indexed token, uint256 amount, address indexed to);

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyTreasuryAdmin() {
        if (msg.sender != treasuryAdmin && msg.sender != owner) revert NotTreasuryAdmin();
        _;
    }

    modifier onlyOperator() {
        if (!policyOperators[msg.sender] && msg.sender != owner) revert NotPolicyOperator();
        _;
    }

    modifier onlyGuardianOrOperator() {
        if (
            msg.sender != emergencyGuardian &&
            !policyOperators[msg.sender] &&
            msg.sender != owner
        ) {
            revert NotGuardianOrOperator();
        }
        _;
    }

    modifier nonReentrant() {
        if (_guard != 0) revert();
        _guard = 1;
        _;
        _guard = 0;
    }

    constructor(address owner_) {
        if (owner_ == address(0)) revert ZeroAddress();
        owner = owner_;
        treasuryAdmin = owner_;
        emergencyGuardian = owner_;
        policyOperators[owner_] = true;
        nextId = 1;

        emit OwnershipTransferred(address(0), owner_);
        emit TreasuryAdminSet(owner_);
        emit EmergencyGuardianSet(owner_);
        emit PolicyOperatorSet(owner_, true);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();

        address previousOwner = owner;
        owner = newOwner;

        if (treasuryAdmin == previousOwner) {
            treasuryAdmin = newOwner;
            emit TreasuryAdminSet(newOwner);
        }

        if (emergencyGuardian == previousOwner) {
            emergencyGuardian = newOwner;
            emit EmergencyGuardianSet(newOwner);
        }

        if (policyOperators[previousOwner]) {
            policyOperators[previousOwner] = false;
            emit PolicyOperatorSet(previousOwner, false);
        }

        if (!policyOperators[newOwner]) {
            policyOperators[newOwner] = true;
            emit PolicyOperatorSet(newOwner, true);
        }

        emit OwnershipTransferred(previousOwner, newOwner);
    }

    function setTreasuryAdmin(address admin) external onlyOwner {
        if (admin == address(0)) revert ZeroAddress();
        treasuryAdmin = admin;
        emit TreasuryAdminSet(admin);
    }

    function setEmergencyGuardian(address guardian) external onlyOwner {
        if (guardian == address(0)) revert ZeroAddress();
        emergencyGuardian = guardian;
        emit EmergencyGuardianSet(guardian);
    }

    function setPolicyOperator(address operator, bool enabled) external onlyOwner {
        if (operator == address(0)) revert ZeroAddress();
        policyOperators[operator] = enabled;
        emit PolicyOperatorSet(operator, enabled);
    }

    function deposit(address token, uint256 amount) external onlyTreasuryAdmin nonReentrant {
        if (token == address(0)) revert ZeroAddress();
        if (amount == 0) revert ZeroAmount();
        bool ok = ITIP20(token).transferFrom(msg.sender, address(this), amount);
        if (!ok) revert InsufficientTreasury();
        emit Deposited(token, amount, msg.sender);
    }

    function withdraw(address token, uint256 amount) external onlyTreasuryAdmin nonReentrant {
        if (amount == 0) revert ZeroAmount();
        uint256 available = unencumberedBalance(token);
        if (amount > available) revert ExceedsUnencumberedBalance();
        bool ok = ITIP20(token).transfer(msg.sender, amount);
        if (!ok) revert InsufficientTreasury();
        emit Withdrawn(token, amount, msg.sender);
    }

    function unencumberedBalance(address token) public view returns (uint256) {
        uint256 bal = ITIP20(token).balanceOf(address(this));
        uint256 reserved = reservedByToken[token];
        return bal > reserved ? bal - reserved : 0;
    }

    function issue(
        address spender,
        address token,
        uint128 spendMax,
        uint128 maxPerTx,
        uint64 validAfter,
        uint64 validUntil,
        uint128 rateLimit,
        uint32 window,
        bytes32 department
    ) external onlyOperator returns (uint256 id) {
        if (spender == address(0) || token == address(0)) revert ZeroAddress();
        if (spendMax == 0) revert InvalidSpendMax();
        if (validUntil < validAfter) revert InvalidValidityRange();
        if (rateLimit > 0 && window == 0) revert InvalidWindow();
        if (unencumberedBalance(token) < uint256(spendMax)) revert InsufficientTreasury();

        id = nextId;
        nextId = id + 1;

        reservedByToken[token] += uint256(spendMax);

        Mandate storage m = mandates[id];
        m.spender = spender;
        m.token = token;
        m.spendMax = spendMax;
        m.remaining = spendMax;
        m.maxPerTx = maxPerTx;
        m.validAfter = validAfter;
        m.validUntil = validUntil;
        m.rateLimit = rateLimit;
        m.window = window;
        m.department = department;

        emit Issued(
            id,
            spender,
            token,
            spendMax,
            maxPerTx,
            validAfter,
            validUntil,
            rateLimit,
            window,
            department
        );
    }

    function topUp(uint256 id, uint128 addedAmount) external onlyOperator {
        if (addedAmount == 0) revert ZeroAmount();
        Mandate storage m = _requireMandate(id);
        if (m.closed) revert MandateClosed();
        if (unencumberedBalance(m.token) < uint256(addedAmount)) revert InsufficientTreasury();

        m.spendMax += addedAmount;
        m.remaining += addedAmount;
        reservedByToken[m.token] += uint256(addedAmount);

        emit ToppedUp(id, addedAmount, m.remaining);
    }

    function setMerchant(uint256 id, address merchant, bool allowed) external onlyOperator {
        if (merchant == address(0)) revert ZeroAddress();
        Mandate storage m = _requireMandate(id);
        if (m.closed) revert MandateClosed();

        bool currently = allowlisted[id][merchant];
        if (currently == allowed) return;

        allowlisted[id][merchant] = allowed;
        if (allowed) {
            allowlistCount[id] += 1;
        } else {
            allowlistCount[id] -= 1;
        }
        emit MerchantSet(id, merchant, allowed);
    }

    function pause(uint256 id) external onlyGuardianOrOperator {
        Mandate storage m = _requireMandate(id);
        if (m.closed) revert MandateClosed();
        if (m.paused) return;
        m.paused = true;
        emit Paused(id, true, msg.sender);
    }

    function unpause(uint256 id) external onlyOperator {
        Mandate storage m = _requireMandate(id);
        if (m.closed) revert MandateClosed();
        if (!m.paused) return;
        m.paused = false;
        emit Paused(id, false, msg.sender);
    }

    function close(uint256 id) external onlyOperator {
        Mandate storage m = _requireMandate(id);
        if (m.closed) revert MandateClosed();
        m.closed = true;
        uint128 released = m.remaining;
        m.remaining = 0;
        if (released > 0) {
            reservedByToken[m.token] -= uint256(released);
        }
        emit Closed(id, released);
    }

    function pay(uint256 id, address merchant, uint128 amount, bytes32 memo) external nonReentrant {
        Mandate storage m = _requireMandate(id);
        if (m.closed) revert MandateClosed();
        if (m.paused) revert MandatePaused();
        if (block.timestamp < m.validAfter) revert MandateNotYetValid();
        if (block.timestamp > m.validUntil) revert MandateExpired();
        if (msg.sender != m.spender) revert NotSpender();
        if (amount == 0) revert ZeroAmount();
        if (m.maxPerTx > 0 && amount > m.maxPerTx) revert PerTxLimitExceeded();
        if (!allowlisted[id][merchant]) revert MerchantNotAllowed();
        if (settledMemos[id][memo]) revert ChallengeAlreadySettled();
        if (m.remaining < amount) revert CapExceeded();

        if (m.rateLimit > 0) {
            if (block.timestamp >= uint256(m.windowStart) + uint256(m.window)) {
                m.windowStart = uint64(block.timestamp);
                m.windowSpent = 0;
            }
            if (uint256(m.windowSpent) + uint256(amount) > uint256(m.rateLimit)) {
                revert RateLimited();
            }
        }

        uint256 bal = ITIP20(m.token).balanceOf(address(this));
        uint256 totalReserved = reservedByToken[m.token];
        if (bal < totalReserved || bal < uint256(amount)) {
            revert InsufficientTreasury();
        }

        settledMemos[id][memo] = true;
        m.remaining = m.remaining - amount;
        reservedByToken[m.token] -= uint256(amount);
        if (m.rateLimit > 0) {
            m.windowSpent = m.windowSpent + amount;
        }

        ITIP20(m.token).transferWithMemo(merchant, uint256(amount), memo);

        emit Paid(id, m.spender, merchant, m.token, amount, memo, m.remaining);
    }

    function _requireMandate(uint256 id) internal view returns (Mandate storage m) {
        if (id == 0 || id >= nextId) revert UnknownMandate();
        m = mandates[id];
    }
}
