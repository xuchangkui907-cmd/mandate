// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MandateBook} from "../src/MandateBook.sol";

/// @dev Minimal TIP-20 mock. Decimals are 6. `transferWithMemo` moves
///      balances and records the last memo so tests can assert MPP challenge ids.
contract MockTIP20 {
    uint8 public constant decimals = 6;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    bytes32 public lastMemo;
    address public lastMemoTo;
    bool public returnFalseOnTransfer;
    bool public returnFalseOnTransferFrom;

    address public reentryTarget;
    uint256 public reentryMandateId;
    address public reentryMerchant;
    uint128 public reentryAmount;
    bytes32 public reentryMemo;
    bool public reentryEnabled;
    bool public reentryAttempted;
    bool public reentrySucceeded;
    uint256 public reentryReturnDataLength;

    function setTransferResults(bool transferResult, bool transferFromResult) external {
        returnFalseOnTransfer = !transferResult;
        returnFalseOnTransferFrom = !transferFromResult;
    }

    function configureReentry(
        address target,
        uint256 mandateId,
        address merchant_,
        uint128 amount,
        bytes32 memo
    ) external {
        reentryTarget = target;
        reentryMandateId = mandateId;
        reentryMerchant = merchant_;
        reentryAmount = amount;
        reentryMemo = memo;
        reentryEnabled = true;
        reentryAttempted = false;
        reentrySucceeded = false;
        reentryReturnDataLength = 0;
    }

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event TransferWithMemo(
        address indexed from, address indexed to, uint256 amount, bytes32 indexed memo
    );

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    // Test-only mechanism to simulate an external balance deficit.
    function burn(address from, uint256 amount) external {
        require(balanceOf[from] >= amount, "BALANCE");
        balanceOf[from] -= amount;
        emit Transfer(from, address(0), amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        if (returnFalseOnTransfer) return false;
        _move(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (returnFalseOnTransferFrom) return false;
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= amount, "ALLOWANCE");
            allowance[from][msg.sender] = allowed - amount;
        }
        _move(from, to, amount);
        return true;
    }

    function transferWithMemo(address to, uint256 amount, bytes32 memo)
        external
    {
        if (reentryEnabled) {
            reentryEnabled = false;
            reentryAttempted = true;

            (bool success, bytes memory result) = reentryTarget.call(
                abi.encodeWithSelector(
                    MandateBook.pay.selector,
                    reentryMandateId,
                    reentryMerchant,
                    reentryAmount,
                    reentryMemo
                )
            );

            reentrySucceeded = success;
            reentryReturnDataLength = result.length;
        }

        _move(msg.sender, to, amount);
        lastMemo = memo;
        lastMemoTo = to;
        emit TransferWithMemo(msg.sender, to, amount, memo);
    }

    function transferFromWithMemo(address from, address to, uint256 amount, bytes32 memo) external {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= amount, "ALLOWANCE");
            allowance[from][msg.sender] = allowed - amount;
        }
        _move(from, to, amount);
        lastMemo = memo;
        lastMemoTo = to;
        emit TransferWithMemo(from, to, amount, memo);
    }

    function _move(address from, address to, uint256 amount) internal {
        require(balanceOf[from] >= amount, "BALANCE");
        unchecked {
            balanceOf[from] -= amount;
            balanceOf[to] += amount;
        }
        emit Transfer(from, to, amount);
    }
}

contract MandateBookTest is Test {
    MockTIP20 internal token;
    MandateBook internal book;

    address internal finance = makeAddr("finance");
    address internal agent = makeAddr("agent");
    address internal merchant = makeAddr("merchant");
    address internal other = makeAddr("other");

    uint128 internal constant ONE = 1_000_000; // $1 at 6 decimals
    bytes32 internal constant DEPT = bytes32("engineering");
    bytes32 internal constant CHALLENGE = bytes32(uint256(0x402));

    function setUp() public {
        token = new MockTIP20();
        book = new MandateBook(finance);
        vm.warp(1_700_000_000);
    }

    function _fund(uint256 amount) internal {
        token.mint(finance, amount);
        vm.startPrank(finance);
        token.approve(address(book), amount);
        book.deposit(address(token), amount);
        vm.stopPrank();
    }

    function _issue(uint128 spendMax, uint128 rateLimit, uint32 window, uint64 ttl)
        internal
        returns (uint256 id)
    {
        return _issueWithPerTx(spendMax, 0, rateLimit, window, ttl);
    }

    function _issueWithPerTx(
        uint128 spendMax,
        uint128 maxPerTx,
        uint128 rateLimit,
        uint32 window,
        uint64 ttl
    ) internal returns (uint256 id) {
        vm.prank(finance);
        id = book.issue(
            agent,
            address(token),
            spendMax,
            maxPerTx,
            uint64(block.timestamp),
            uint64(block.timestamp) + ttl,
            rateLimit,
            window,
            DEPT
        );
    }

    function _allow(uint256 id) internal {
        vm.prank(finance);
        book.setMerchant(id, merchant, true);
    }

    function test_reentrantTokenCallbackIsRejected() public {
        _fund(2 * ONE);
        uint256 id = _issue(2 * ONE, 0, 0, 30 days);
        _allow(id);

        bytes32 reentryMemo = bytes32(uint256(0x403));
        token.configureReentry(
            address(book),
            id,
            merchant,
            ONE,
            reentryMemo
        );

        vm.prank(agent);
        book.pay(id, merchant, ONE, CHALLENGE);

        // The token attempted a nested pay(), but the guard rejected it.
        assertTrue(token.reentryAttempted());
        assertFalse(token.reentrySucceeded());
        assertEq(token.reentryReturnDataLength(), 0);

        // The outer payment still completed exactly once.
        assertEq(token.balanceOf(merchant), ONE);
        assertEq(token.balanceOf(address(book)), ONE);
        assertTrue(book.settledMemos(id, CHALLENGE));
        assertFalse(book.settledMemos(id, reentryMemo));

        (,,, uint128 remaining,,,,,,,,,,) = book.mandates(id);
        assertEq(remaining, ONE);
    }

    function test_happyPay() public {
        _fund(10 * ONE);
        uint256 id = _issue(5 * ONE, 0, 0, 30 days);
        _allow(id);

        vm.prank(agent);
        book.pay(id, merchant, ONE, CHALLENGE);

        assertEq(token.balanceOf(merchant), ONE);
        assertEq(token.balanceOf(address(book)), 9 * ONE);
        assertEq(token.lastMemo(), CHALLENGE);
        assertEq(token.lastMemoTo(), merchant);

        (,,, uint128 remaining,,,,,,,,,,) = book.mandates(id);
        assertEq(remaining, 4 * ONE);
        assertEq(book.allowlistCount(id), 1);
    }

    function test_duplicateMemoRevertsWithoutSecondPayment() public {
        _fund(3 * ONE);
        uint256 id = _issue(3 * ONE, 0, 0, 30 days);
        _allow(id);

        vm.prank(agent);
        book.pay(id, merchant, ONE, CHALLENGE);

        assertTrue(book.settledMemos(id, CHALLENGE));
        assertEq(token.balanceOf(merchant), ONE);

        vm.prank(agent);
        vm.expectRevert(MandateBook.ChallengeAlreadySettled.selector);
        book.pay(id, merchant, ONE, CHALLENGE);

        // The reverted duplicate must not transfer tokens or consume mandate funds.
        assertEq(token.balanceOf(merchant), ONE);
        assertEq(token.balanceOf(address(book)), 2 * ONE);
        assertTrue(book.settledMemos(id, CHALLENGE));

        (,,, uint128 remaining,,,,,,,,,,) = book.mandates(id);
        assertEq(remaining, 2 * ONE);
    }

    function test_distinctMemosCanBothBePaid() public {
        _fund(3 * ONE);
        uint256 id = _issue(3 * ONE, 0, 0, 30 days);
        _allow(id);

        bytes32 secondMemo = bytes32(uint256(0x403));

        vm.startPrank(agent);
        book.pay(id, merchant, ONE, CHALLENGE);
        book.pay(id, merchant, ONE, secondMemo);
        vm.stopPrank();

        assertEq(token.balanceOf(merchant), 2 * ONE);
        assertTrue(book.settledMemos(id, CHALLENGE));
        assertTrue(book.settledMemos(id, secondMemo));

        (,,, uint128 remaining,,,,,,,,,,) = book.mandates(id);
        assertEq(remaining, ONE);
    }

    function test_emptyAllowlistRevertsMerchantNotAllowed() public {
        _fund(ONE);
        uint256 id = _issue(ONE, 0, 0, 30 days);

        vm.prank(agent);
        vm.expectRevert(MandateBook.MerchantNotAllowed.selector);
        book.pay(id, merchant, ONE, CHALLENGE);
    }

    function test_notSpender() public {
        _fund(ONE);
        uint256 id = _issue(ONE, 0, 0, 30 days);
        _allow(id);

        vm.prank(other);
        vm.expectRevert(MandateBook.NotSpender.selector);
        book.pay(id, merchant, ONE, CHALLENGE);
    }

    function test_paused() public {
        _fund(2 * ONE);
        uint256 id = _issue(2 * ONE, 0, 0, 30 days);
        _allow(id);

        vm.prank(finance);
        book.pause(id);

        vm.prank(agent);
        vm.expectRevert(MandateBook.MandatePaused.selector);
        book.pay(id, merchant, ONE, CHALLENGE);

        vm.prank(finance);
        book.unpause(id);

        vm.prank(agent);
        book.pay(id, merchant, ONE, CHALLENGE);
        assertEq(token.balanceOf(merchant), ONE);
    }

    function test_expired() public {
        _fund(ONE);
        uint256 id = _issue(ONE, 0, 0, 1 hours);
        _allow(id);

        vm.warp(block.timestamp + 1 hours + 1);

        vm.prank(agent);
        vm.expectRevert(MandateBook.MandateExpired.selector);
        book.pay(id, merchant, ONE, CHALLENGE);
    }

    function test_capExceeded() public {
        _fund(10 * ONE);
        uint256 id = _issue(ONE, 0, 0, 30 days);
        _allow(id);

        vm.prank(agent);
        vm.expectRevert(MandateBook.CapExceeded.selector);
        book.pay(id, merchant, ONE + 1, CHALLENGE);

        vm.prank(agent);
        book.pay(id, merchant, ONE, CHALLENGE);

        vm.prank(agent);
        vm.expectRevert(MandateBook.CapExceeded.selector);
        book.pay(id, merchant, 1, bytes32(uint256(0x403)));
    }

    function test_rateLimit() public {
        _fund(10 * ONE);
        uint256 id = _issue(10 * ONE, ONE, 1 hours, 30 days);
        _allow(id);

        vm.prank(agent);
        book.pay(id, merchant, ONE, CHALLENGE);

        vm.prank(agent);
        vm.expectRevert(MandateBook.RateLimited.selector);
        book.pay(id, merchant, 1, bytes32(uint256(0x403)));
    }

    function test_windowReset() public {
        _fund(10 * ONE);
        uint256 id = _issue(10 * ONE, ONE, 1 hours, 30 days);
        _allow(id);

        vm.prank(agent);
        book.pay(id, merchant, ONE, CHALLENGE);

        vm.prank(agent);
        vm.expectRevert(MandateBook.RateLimited.selector);
        book.pay(id, merchant, 1, bytes32(uint256(0x403)));

        vm.warp(block.timestamp + 1 hours);

        vm.prank(agent);
        book.pay(id, merchant, ONE, bytes32(uint256(0x404)));
        assertEq(token.balanceOf(merchant), 2 * ONE);

        (,,,,,,,,, uint128 windowSpent,,,,) = book.mandates(id);
        assertEq(windowSpent, ONE);
    }

    function test_zeroAmount() public {
        _fund(ONE);
        uint256 id = _issue(ONE, 0, 0, 30 days);
        _allow(id);

        vm.prank(agent);
        vm.expectRevert(MandateBook.ZeroAmount.selector);
        book.pay(id, merchant, 0, CHALLENGE);
    }

    function test_depositWithdraw() public {
        token.mint(finance, 5 * ONE);

        vm.startPrank(finance);
        token.approve(address(book), 5 * ONE);
        book.deposit(address(token), 5 * ONE);
        vm.stopPrank();

        assertEq(token.balanceOf(address(book)), 5 * ONE);
        assertEq(token.balanceOf(finance), 0);

        vm.prank(finance);
        book.withdraw(address(token), 2 * ONE);

        assertEq(token.balanceOf(address(book)), 3 * ONE);
        assertEq(token.balanceOf(finance), 2 * ONE);

        vm.prank(other);
        vm.expectRevert(MandateBook.NotTreasuryAdmin.selector);
        book.withdraw(address(token), 1);

        vm.prank(finance);
        vm.expectRevert(MandateBook.ExceedsUnencumberedBalance.selector);
        book.withdraw(address(token), 4 * ONE);
    }

    function test_closedStopsPay() public {
        _fund(ONE);
        uint256 id = _issue(ONE, 0, 0, 30 days);
        _allow(id);

        vm.prank(finance);
        book.close(id);

        vm.prank(agent);
        vm.expectRevert(MandateBook.MandateClosed.selector);
        book.pay(id, merchant, ONE, CHALLENGE);

        assertEq(token.balanceOf(address(book)), ONE);
    }

    function test_notYetValid() public {
        _fund(ONE);
        vm.prank(finance);
        uint256 id = book.issue(
            agent,
            address(token),
            ONE,
            0,
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 30 days),
            0,
            0,
            DEPT
        );
        _allow(id);

        vm.prank(agent);
        vm.expectRevert(MandateBook.MandateNotYetValid.selector);
        book.pay(id, merchant, ONE, CHALLENGE);

        vm.warp(block.timestamp + 1 days);
        vm.prank(agent);
        book.pay(id, merchant, ONE, CHALLENGE);
        assertEq(token.balanceOf(merchant), ONE);
    }

    function test_unknownMandate() public {
        vm.prank(finance);
        vm.expectRevert(MandateBook.UnknownMandate.selector);
        book.pause(99);
    }

    function test_invalidSpendMaxAndWindow() public {
        vm.prank(finance);
        vm.expectRevert(MandateBook.InvalidSpendMax.selector);
        book.issue(agent, address(token), 0, 0, 1, 100, 0, 0, DEPT);

        vm.prank(finance);
        vm.expectRevert(MandateBook.InvalidWindow.selector);
        book.issue(agent, address(token), ONE, 0, 1, 100, ONE, 0, DEPT);
    }

    function test_insufficientTreasury() public {
        _fund(ONE);
        uint256 id = _issue(ONE, 0, 0, 30 days);
        _allow(id);

        // Simulate an unexpected loss of one unit from the contract balance.
        token.burn(address(book), 1);

        vm.prank(agent);
        vm.expectRevert(MandateBook.InsufficientTreasury.selector);
        book.pay(id, merchant, ONE, CHALLENGE);

        assertEq(book.reservedByToken(address(token)), ONE);
    }

    function test_setMerchantToggleCount() public {
        _fund(2 * ONE);
        uint256 id = _issue(ONE, 0, 0, 30 days);

        vm.startPrank(finance);
        book.setMerchant(id, merchant, true);
        book.setMerchant(id, other, true);
        assertEq(book.allowlistCount(id), 2);
        book.setMerchant(id, merchant, false);
        assertEq(book.allowlistCount(id), 1);
        book.setMerchant(id, merchant, false);
        assertEq(book.allowlistCount(id), 1);
        vm.stopPrank();

        assertTrue(book.allowlisted(id, other));
        assertFalse(book.allowlisted(id, merchant));
    }

    function test_authorizationRoles() public {
        vm.expectRevert(MandateBook.NotPolicyOperator.selector);
        book.issue(agent, address(token), ONE, 0, 1, 100, 0, 0, DEPT);

        token.mint(other, ONE);
        vm.startPrank(other);
        token.approve(address(book), ONE);
        vm.expectRevert(MandateBook.NotTreasuryAdmin.selector);
        book.deposit(address(token), ONE);
        vm.stopPrank();
    }

    function test_perTransactionLimit() public {
        _fund(2 * ONE);
        uint256 id = _issueWithPerTx(2 * ONE, ONE / 2, 0, 0, 30 days);
        _allow(id);

        vm.prank(agent);
        vm.expectRevert(MandateBook.PerTxLimitExceeded.selector);
        book.pay(id, merchant, ONE, CHALLENGE);

        vm.prank(agent);
        book.pay(id, merchant, ONE / 2, CHALLENGE);

        assertEq(token.balanceOf(merchant), ONE / 2);
    }

    function test_reservedFundsCannotBeWithdrawn() public {
        _fund(10 * ONE);
        _issue(8 * ONE, 0, 0, 30 days);

        assertEq(book.reservedByToken(address(token)), 8 * ONE);
        assertEq(book.unencumberedBalance(address(token)), 2 * ONE);

        vm.prank(finance);
        vm.expectRevert(MandateBook.ExceedsUnencumberedBalance.selector);
        book.withdraw(address(token), 3 * ONE);

        vm.prank(finance);
        book.withdraw(address(token), 2 * ONE);

        assertEq(token.balanceOf(address(book)), 8 * ONE);
        assertEq(book.reservedByToken(address(token)), 8 * ONE);
        assertEq(book.unencumberedBalance(address(token)), 0);
    }

    function test_reservationReleasedByPaymentAndClose() public {
        _fund(5 * ONE);
        uint256 id = _issue(4 * ONE, 0, 0, 30 days);
        _allow(id);

        assertEq(book.reservedByToken(address(token)), 4 * ONE);

        vm.prank(agent);
        book.pay(id, merchant, ONE, CHALLENGE);

        assertEq(book.reservedByToken(address(token)), 3 * ONE);
        assertEq(book.unencumberedBalance(address(token)), ONE);

        vm.prank(finance);
        book.close(id);

        assertEq(book.reservedByToken(address(token)), 0);
        assertEq(token.balanceOf(address(book)), 4 * ONE);
        assertEq(book.unencumberedBalance(address(token)), 4 * ONE);
    }

    function test_transferOwnershipSynchronizesDefaultRoles() public {
        _fund(ONE);
        address newOwner = makeAddr("newOwner");

        vm.prank(finance);
        book.transferOwnership(newOwner);

        assertEq(book.owner(), newOwner);
        assertEq(book.treasuryAdmin(), newOwner);
        assertEq(book.emergencyGuardian(), newOwner);
        assertFalse(book.policyOperators(finance));
        assertTrue(book.policyOperators(newOwner));

        vm.prank(finance);
        vm.expectRevert(MandateBook.NotPolicyOperator.selector);
        book.issue(agent, address(token), ONE, 0, uint64(block.timestamp),
            uint64(block.timestamp + 30 days), 0, 0, DEPT);

        vm.prank(newOwner);
        uint256 id = book.issue(
            agent,
            address(token),
            ONE,
            0,
            uint64(block.timestamp),
            uint64(block.timestamp + 30 days),
            0,
            0,
            DEPT
        );
        assertEq(id, 1);

        vm.prank(finance);
        vm.expectRevert(MandateBook.NotGuardianOrOperator.selector);
        book.pause(id);
    }

    function test_transferOwnershipPreservesDelegatedRoles() public {
        address newOwner = makeAddr("newOwner");

        vm.startPrank(finance);
        book.setTreasuryAdmin(other);
        book.setEmergencyGuardian(agent);
        book.setPolicyOperator(agent, true);
        book.transferOwnership(newOwner);
        vm.stopPrank();

        assertEq(book.owner(), newOwner);
        assertEq(book.treasuryAdmin(), other);
        assertEq(book.emergencyGuardian(), agent);
        assertTrue(book.policyOperators(agent));
        assertFalse(book.policyOperators(finance));
        assertTrue(book.policyOperators(newOwner));
    }

    // ---------------------------------------------------------------------
    // Additional boundary and failure-path coverage
    // ---------------------------------------------------------------------

    function test_topUpIncreasesSpendMaxRemainingAndReservation() public {
        _fund(3 * ONE);
        uint256 id = _issue(ONE, 0, 0, 30 days);

        // The original mandate reserves ONE; two more units remain free.
        vm.prank(finance);
        book.topUp(id, 2 * ONE);

        (,, uint128 spendMax, uint128 remaining,,,,,,,,,,) = book.mandates(id);
        assertEq(spendMax, 3 * ONE);
        assertEq(remaining, 3 * ONE);
        assertEq(book.reservedByToken(address(token)), 3 * ONE);
        assertEq(book.unencumberedBalance(address(token)), 0);
    }

    function test_topUpZeroAmountReverts() public {
        _fund(2 * ONE);
        uint256 id = _issue(ONE, 0, 0, 30 days);

        vm.prank(finance);
        vm.expectRevert(MandateBook.ZeroAmount.selector);
        book.topUp(id, 0);
    }

    function test_topUpUnknownMandateReverts() public {
        vm.prank(finance);
        vm.expectRevert(MandateBook.UnknownMandate.selector);
        book.topUp(99, ONE);
    }

    function test_topUpClosedMandateReverts() public {
        _fund(2 * ONE);
        uint256 id = _issue(ONE, 0, 0, 30 days);

        vm.prank(finance);
        book.close(id);

        vm.prank(finance);
        vm.expectRevert(MandateBook.MandateClosed.selector);
        book.topUp(id, ONE);
    }

    function test_topUpInsufficientUnencumberedTreasuryReverts() public {
        _fund(ONE);
        uint256 id = _issue(ONE, 0, 0, 30 days);

        vm.prank(finance);
        vm.expectRevert(MandateBook.InsufficientTreasury.selector);
        book.topUp(id, 1);
    }

    function test_nonOperatorCannotTopUp() public {
        _fund(2 * ONE);
        uint256 id = _issue(ONE, 0, 0, 30 days);

        vm.prank(other);
        vm.expectRevert(MandateBook.NotPolicyOperator.selector);
        book.topUp(id, ONE);
    }

    function test_authorizedNonOwnerPolicyOperatorCanIssue() public {
        _fund(ONE);

        vm.prank(finance);
        book.setPolicyOperator(other, true);

        vm.prank(other);
        uint256 id = book.issue(
            agent,
            address(token),
            ONE,
            0,
            uint64(block.timestamp),
            uint64(block.timestamp + 30 days),
            0,
            0,
            DEPT
        );

        assertEq(id, 1);
        assertEq(book.nextId(), 2);
    }

    function test_constructorRejectsZeroOwner() public {
        vm.expectRevert(MandateBook.ZeroAddress.selector);
        new MandateBook(address(0));
    }

    function test_ownerSettersRejectZeroAddresses() public {
        vm.startPrank(finance);

        vm.expectRevert(MandateBook.ZeroAddress.selector);
        book.transferOwnership(address(0));

        vm.expectRevert(MandateBook.ZeroAddress.selector);
        book.setTreasuryAdmin(address(0));

        vm.expectRevert(MandateBook.ZeroAddress.selector);
        book.setEmergencyGuardian(address(0));

        vm.expectRevert(MandateBook.ZeroAddress.selector);
        book.setPolicyOperator(address(0), true);

        vm.stopPrank();
    }

    function test_nonOwnerCannotChangeOwnerManagedRoles() public {
        vm.startPrank(other);

        vm.expectRevert(MandateBook.NotOwner.selector);
        book.setTreasuryAdmin(other);

        vm.expectRevert(MandateBook.NotOwner.selector);
        book.setEmergencyGuardian(other);

        vm.expectRevert(MandateBook.NotOwner.selector);
        book.setPolicyOperator(other, true);

        vm.expectRevert(MandateBook.NotOwner.selector);
        book.transferOwnership(other);

        vm.stopPrank();
    }

    function test_depositRejectsZeroTokenAndZeroAmount() public {
        vm.startPrank(finance);

        vm.expectRevert(MandateBook.ZeroAddress.selector);
        book.deposit(address(0), ONE);

        vm.expectRevert(MandateBook.ZeroAmount.selector);
        book.deposit(address(token), 0);

        vm.stopPrank();
    }

    function test_depositRevertsWhenTokenTransferFromReturnsFalse() public {
        token.mint(finance, ONE);

        vm.startPrank(finance);
        token.approve(address(book), ONE);
        token.setTransferResults(true, false);

        vm.expectRevert(MandateBook.InsufficientTreasury.selector);
        book.deposit(address(token), ONE);
        vm.stopPrank();

        assertEq(token.balanceOf(address(book)), 0);
        assertEq(token.balanceOf(finance), ONE);
    }

    function test_withdrawRejectsZeroAmount() public {
        _fund(ONE);

        vm.prank(finance);
        vm.expectRevert(MandateBook.ZeroAmount.selector);
        book.withdraw(address(token), 0);
    }

    function test_withdrawRevertsWhenTokenTransferReturnsFalse() public {
        _fund(2 * ONE);
        token.setTransferResults(false, true);

        vm.prank(finance);
        vm.expectRevert(MandateBook.InsufficientTreasury.selector);
        book.withdraw(address(token), ONE);

        assertEq(token.balanceOf(address(book)), 2 * ONE);
        assertEq(token.balanceOf(finance), 0);
    }

    function test_issueRejectsZeroSpenderAndZeroToken() public {
        _fund(2 * ONE);

        vm.startPrank(finance);

        vm.expectRevert(MandateBook.ZeroAddress.selector);
        book.issue(
            address(0), address(token), ONE, 0,
            uint64(block.timestamp), uint64(block.timestamp + 1 days),
            0, 0, DEPT
        );

        vm.expectRevert(MandateBook.ZeroAddress.selector);
        book.issue(
            agent, address(0), ONE, 0,
            uint64(block.timestamp), uint64(block.timestamp + 1 days),
            0, 0, DEPT
        );

        vm.stopPrank();
    }

    function test_issueRejectsInvalidValidityRange() public {
        _fund(2 * ONE);

        vm.prank(finance);
        vm.expectRevert(MandateBook.InvalidValidityRange.selector);
        book.issue(
            agent, address(token), ONE, 0,
            uint64(block.timestamp + 2 days), uint64(block.timestamp + 1 days),
            0, 0, DEPT
        );
    }

    function test_issueRejectsInsufficientUnencumberedTreasury() public {
        _fund(ONE);

        vm.prank(finance);
        vm.expectRevert(MandateBook.InsufficientTreasury.selector);
        book.issue(
            agent, address(token), 2 * ONE, 0,
            uint64(block.timestamp), uint64(block.timestamp + 1 days),
            0, 0, DEPT
        );
    }

    function test_nonGuardianOrOperatorCannotPause() public {
        _fund(ONE);
        uint256 id = _issue(ONE, 0, 0, 30 days);

        vm.prank(other);
        vm.expectRevert(MandateBook.NotGuardianOrOperator.selector);
        book.pause(id);
    }

    function test_pauseAndUnpauseAreIdempotent() public {
        _fund(ONE);
        uint256 id = _issue(ONE, 0, 0, 30 days);

        vm.startPrank(finance);
        book.pause(id);
        book.pause(id);
        (,,,,,,,,,,, bool paused,,) = book.mandates(id);
        assertTrue(paused);

        book.unpause(id);
        book.unpause(id);
        (,,,,,,,,,,, paused,,) = book.mandates(id);
        assertFalse(paused);
        vm.stopPrank();
    }

    function test_pauseAndUnpauseRejectClosedMandate() public {
        _fund(ONE);
        uint256 id = _issue(ONE, 0, 0, 30 days);

        vm.prank(finance);
        book.close(id);

        vm.startPrank(finance);
        vm.expectRevert(MandateBook.MandateClosed.selector);
        book.pause(id);

        vm.expectRevert(MandateBook.MandateClosed.selector);
        book.unpause(id);
        vm.stopPrank();
    }

    function test_setMerchantRejectsZeroAddressAndClosedMandate() public {
        _fund(ONE);
        uint256 id = _issue(ONE, 0, 0, 30 days);

        vm.startPrank(finance);
        vm.expectRevert(MandateBook.ZeroAddress.selector);
        book.setMerchant(id, address(0), true);

        book.close(id);

        vm.expectRevert(MandateBook.MandateClosed.selector);
        book.setMerchant(id, merchant, true);
        vm.stopPrank();
    }

    function test_closeRejectsAlreadyClosedMandate() public {
        _fund(ONE);
        uint256 id = _issue(ONE, 0, 0, 30 days);

        vm.startPrank(finance);
        book.close(id);

        vm.expectRevert(MandateBook.MandateClosed.selector);
        book.close(id);
        vm.stopPrank();
    }

}
