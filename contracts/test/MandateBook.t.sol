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

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event TransferWithMemo(
        address indexed from, address indexed to, uint256 amount, bytes32 indexed memo
    );

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _move(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            require(allowed >= amount, "ALLOWANCE");
            allowance[from][msg.sender] = allowed - amount;
        }
        _move(from, to, amount);
        return true;
    }

    function transferWithMemo(address to, uint256 amount, bytes32 memo) external {
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
        vm.prank(finance);
        id = book.issue(
            agent,
            address(token),
            spendMax,
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

        (,,, uint128 remaining,,,,,,,,,) = book.mandates(id);
        assertEq(remaining, 4 * ONE);
        assertEq(book.allowlistCount(id), 1);
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
        book.pay(id, merchant, 1, CHALLENGE);
    }

    function test_rateLimit() public {
        _fund(10 * ONE);
        uint256 id = _issue(10 * ONE, ONE, 1 hours, 30 days);
        _allow(id);

        vm.prank(agent);
        book.pay(id, merchant, ONE, CHALLENGE);

        vm.prank(agent);
        vm.expectRevert(MandateBook.RateLimited.selector);
        book.pay(id, merchant, 1, CHALLENGE);
    }

    function test_windowReset() public {
        _fund(10 * ONE);
        uint256 id = _issue(10 * ONE, ONE, 1 hours, 30 days);
        _allow(id);

        vm.prank(agent);
        book.pay(id, merchant, ONE, CHALLENGE);

        vm.prank(agent);
        vm.expectRevert(MandateBook.RateLimited.selector);
        book.pay(id, merchant, 1, CHALLENGE);

        vm.warp(block.timestamp + 1 hours);

        vm.prank(agent);
        book.pay(id, merchant, ONE, bytes32(uint256(0x403)));
        assertEq(token.balanceOf(merchant), 2 * ONE);

        (,,,,,,,, uint128 windowSpent,,,,) = book.mandates(id);
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
        vm.expectRevert(MandateBook.NotOwner.selector);
        book.withdraw(address(token), 1);

        vm.prank(finance);
        vm.expectRevert(MandateBook.InsufficientTreasury.selector);
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
        book.issue(agent, address(token), 0, 1, 100, 0, 0, DEPT);

        vm.prank(finance);
        vm.expectRevert(MandateBook.InvalidWindow.selector);
        book.issue(agent, address(token), ONE, 1, 100, ONE, 0, DEPT);
    }

    function test_insufficientTreasury() public {
        uint256 id = _issue(ONE, 0, 0, 30 days);
        _allow(id);

        vm.prank(agent);
        vm.expectRevert(MandateBook.InsufficientTreasury.selector);
        book.pay(id, merchant, ONE, CHALLENGE);
    }

    function test_setMerchantToggleCount() public {
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

    function test_onlyOwnerIssueDepositPause() public {
        vm.expectRevert(MandateBook.NotOwner.selector);
        book.issue(agent, address(token), ONE, 1, 100, 0, 0, DEPT);

        token.mint(other, ONE);
        vm.startPrank(other);
        token.approve(address(book), ONE);
        vm.expectRevert(MandateBook.NotOwner.selector);
        book.deposit(address(token), ONE);
        vm.stopPrank();
    }
}
