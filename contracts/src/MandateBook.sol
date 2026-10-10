// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {ITIP20} from "./interfaces/ITIP20.sol";

/// @title MandateBook
/// @notice Policy-bound spend authorization on Tempo. Finance deposits TIP-20
///         stablecoins into this contract; each Mandate is a spend policy
///         (who can pay, how much, to which merchants, until when, at what
///         rate). Agents never hold treasury keys — they only call `pay`.
/// @dev Why Tempo:
///      - Stablecoin gas: no native token; fees are USD TIP-20 via the Fee
///        Manager at 0xfeec000000000000000000000000000000000000.
///      - Payment lanes: TIP-20 transfers get reserved blockspace, so agent
///        payments are not crowded out by other traffic.
///      - ~0.6s finality: fast enough for synchronous MPP (HTTP 402 challenge
///        → on-chain pay with memo = challenge id → receipt).
///      - `transferWithMemo` is the settlement primitive; empty merchant
///        allowlist is fail-closed (cannot pay anyone).
contract MandateBook {
    struct Mandate {
        address spender;
        address token;
        uint128 spendMax;
        uint128 remaining;
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

    /// @notice Finance owner. Holds the treasury keys; issues and revokes policy.
    address public owner;

    /// @notice Next mandate id. Starts at 1; id 0 is never valid.
    uint256 public nextId;

    mapping(uint256 => Mandate) public mandates;

    /// @notice Per-mandate merchant allowlist. Empty (count == 0) is fail-closed.
    mapping(uint256 => mapping(address => bool)) public allowlisted;

    mapping(uint256 => uint256) public allowlistCount;

    /// @dev Simple nonReentrant mutex. 0 = free, 1 = locked.
    uint256 private _guard;

    error UnknownMandate();
    error NotOwner();
    error NotSpender();
    error MandatePaused();
    error MandateClosed();
    error MandateNotYetValid();
    error MandateExpired();
    error MerchantNotAllowed();
    error CapExceeded();
    error RateLimited();
    error InsufficientTreasury();
    error ZeroAmount();
    error InvalidWindow();
    error InvalidSpendMax();

    event Issued(
        uint256 indexed id,
        address indexed spender,
        address indexed token,
        uint128 spendMax,
        uint64 validAfter,
        uint64 validUntil,
        uint128 rateLimit,
        uint32 window,
        bytes32 department
    );
    event MerchantSet(uint256 indexed id, address indexed merchant, bool allowed);
    event Paused(uint256 indexed id, bool paused);
    event Closed(uint256 indexed id);
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

    modifier nonReentrant() {
        if (_guard != 0) revert();
        _guard = 1;
        _;
        _guard = 0;
    }

    /// @notice Set finance as the sole owner of the book and its treasury.
    /// @param owner_ Finance address. Must be non-zero.
    constructor(address owner_) {
        if (owner_ == address(0)) revert NotOwner();
        owner = owner_;
        nextId = 1;
    }

    /// @notice Pull TIP-20 from finance into the shared treasury.
    /// @dev Pooled funds: mandate `remaining` is a policy cap, not an escrow.
    ///      Uses `transferFrom` (finance must approve this contract).
    /// @param token TIP-20 token (decimals always 6 on Tempo).
    /// @param amount Base units to deposit.
    function deposit(address token, uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        bool ok = ITIP20(token).transferFrom(msg.sender, address(this), amount);
        if (!ok) revert InsufficientTreasury();
        emit Deposited(token, amount, msg.sender);
    }

    /// @notice Return TIP-20 from the treasury to finance.
    /// @dev Close does not auto-refund; unused remaining is withdrawn here.
    /// @param token TIP-20 token.
    /// @param amount Base units to withdraw.
    function withdraw(address token, uint256 amount) external onlyOwner nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (ITIP20(token).balanceOf(address(this)) < amount) revert InsufficientTreasury();
        bool ok = ITIP20(token).transfer(msg.sender, amount);
        if (!ok) revert InsufficientTreasury();
        emit Withdrawn(token, amount, msg.sender);
    }

    /// @notice Issue a spend policy. `remaining` starts at `spendMax`.
    /// @dev Agent (`spender`) never receives treasury keys. `rateLimit` 0 means
    ///      unlimited. Non-zero `rateLimit` requires a positive `window`.
    /// @param spender Agent that may call `pay`.
    /// @param token TIP-20 the mandate spends.
    /// @param spendMax Lifetime cap in token base units.
    /// @param validAfter Inclusive unix start.
    /// @param validUntil Inclusive unix end.
    /// @param rateLimit Max spent per `window` (0 = unlimited).
    /// @param window Rate-limit window length in seconds.
    /// @param department Opaque finance tag.
    /// @return id Newly issued mandate id.
    function issue(
        address spender,
        address token,
        uint128 spendMax,
        uint64 validAfter,
        uint64 validUntil,
        uint128 rateLimit,
        uint32 window,
        bytes32 department
    ) external onlyOwner returns (uint256 id) {
        if (spendMax == 0) revert InvalidSpendMax();
        if (rateLimit > 0 && window == 0) revert InvalidWindow();

        id = nextId;
        nextId = id + 1;

        Mandate storage m = mandates[id];
        m.spender = spender;
        m.token = token;
        m.spendMax = spendMax;
        m.remaining = spendMax;
        m.validAfter = validAfter;
        m.validUntil = validUntil;
        m.rateLimit = rateLimit;
        m.window = window;
        m.department = department;

        emit Issued(
            id, spender, token, spendMax, validAfter, validUntil, rateLimit, window, department
        );
    }

    /// @notice Add or remove a merchant from a mandate's allowlist.
    /// @dev Empty allowlist is fail-closed: `pay` cannot succeed until at
    ///      least one merchant is allowed.
    /// @param id Mandate id.
    /// @param merchant Recipient address.
    /// @param allowed True to allow, false to revoke.
    function setMerchant(uint256 id, address merchant, bool allowed) external onlyOwner {
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

    /// @notice Freeze payments on a mandate. Treasury is untouched.
    /// @param id Mandate id.
    function pause(uint256 id) external onlyOwner {
        Mandate storage m = _requireMandate(id);
        if (m.closed) revert MandateClosed();
        if (m.paused) return;
        m.paused = true;
        emit Paused(id, true);
    }

    /// @notice Resume payments on a paused mandate.
    /// @param id Mandate id.
    function unpause(uint256 id) external onlyOwner {
        Mandate storage m = _requireMandate(id);
        if (m.closed) revert MandateClosed();
        if (!m.paused) return;
        m.paused = false;
        emit Paused(id, false);
    }

    /// @notice Permanently close a mandate. Remaining is not refunded.
    /// @dev Owner withdraws unused treasury separately. Close is one-way.
    /// @param id Mandate id.
    function close(uint256 id) external onlyOwner {
        Mandate storage m = _requireMandate(id);
        if (m.closed) revert MandateClosed();
        m.closed = true;
        emit Closed(id);
    }

    /// @notice Spend under a mandate: TIP-20 `transferWithMemo` to `merchant`.
    /// @dev `memo` is the MPP challenge id from the HTTP 402. Tempo payment
    ///      lanes + ~0.6s finality make this safe to do inline with the retry
    ///      that collects the receipt. `msg.sender` must be the spender.
    /// @param id Mandate id.
    /// @param merchant Allowlisted recipient.
    /// @param amount Base units to send (TIP-20 decimals = 6).
    /// @param memo MPP challenge id (bytes32).
    function pay(uint256 id, address merchant, uint128 amount, bytes32 memo) external nonReentrant {
        Mandate storage m = _requireMandate(id);
        if (m.closed) revert MandateClosed();
        if (m.paused) revert MandatePaused();
        if (block.timestamp < m.validAfter) revert MandateNotYetValid();
        if (block.timestamp > m.validUntil) revert MandateExpired();
        if (msg.sender != m.spender) revert NotSpender();
        if (amount == 0) revert ZeroAmount();
        if (!allowlisted[id][merchant]) revert MerchantNotAllowed();
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
        if (bal < uint256(amount)) revert InsufficientTreasury();

        m.remaining = m.remaining - amount;
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
