// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {DeployScript} from "../script/Deploy.s.sol";
import {DeployMandateBookModerato} from "../script/DeployModerato.s.sol";

contract DeployNetworkGuardTest is Test {
    function test_mainnetScriptRejectsModerato() public {
        vm.chainId(42431);

        DeployScript script = new DeployScript();

        vm.expectRevert(
            abi.encodeWithSignature(
                "Error(string)",
                "Wrong network: expected Tempo Mainnet (4217)"
            )
        );

        script.run();
    }

    function test_moderatoScriptRejectsMainnet() public {
        vm.chainId(4217);

        DeployMandateBookModerato script = new DeployMandateBookModerato();

        vm.expectRevert(
            abi.encodeWithSignature(
                "Error(string)",
                "Wrong network: expected Tempo Moderato (42431)"
            )
        );

        script.run();
    }
}
