// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

/// @title ITIP20
/// @notice Minimal TIP-20 interface used by MandateBook.
/// @dev TIP-20 extends ERC-20. Decimals are always 6. Tempo has no native gas
///      token: USD TIP-20 (e.g. pathUSD) pays fees, and `transferWithMemo`
///      rides payment lanes (~0.6s finality). `memo` is the 32-byte MPP
///      challenge id for HTTP 402 → on-chain pay → receipt.
interface ITIP20 {
    function decimals() external view returns (uint8);

    function balanceOf(address account) external view returns (uint256);

    function transfer(address to, uint256 amount) external returns (bool);

    function transferFrom(address from, address to, uint256 amount) external returns (bool);

    function transferWithMemo(address to, uint256 amount, bytes32 memo) external;

    function transferFromWithMemo(address from, address to, uint256 amount, bytes32 memo) external;
}
