// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {MandateBook} from "../src/MandateBook.sol";

/// @notice Deploy MandateBook with the broadcast sender as finance owner.
/// @dev Tempo Mainnet chainId 4217. There is no native gas token — the
///      deployer must hold pathUSD (0x20c0000000000000000000000000000000000000)
///      to pay fees via Fee Manager (0xfeec000000000000000000000000000000000000).
///      TIP-20 factory: 0x20Fc000000000000000000000000000000000000.
///
///      forge script script/Deploy.s.sol:DeployScript --rpc-url $TEMPO_RPC --broadcast
///      RPC: see https://docs.tempo.xyz (mainnet chainId 4217).
contract DeployScript is Script {
    function run() external returns (MandateBook book) {
        vm.startBroadcast();
        book = new MandateBook(msg.sender);
        vm.stopBroadcast();
    }
}
