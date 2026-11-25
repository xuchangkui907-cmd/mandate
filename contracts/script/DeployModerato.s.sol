// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MandateBook} from "../src/MandateBook.sol";
import {ITIP20} from "../src/interfaces/ITIP20.sol";

/// @title DeployMandateBookModerato
/// @notice Deploys MandateBook v2 strictly to Tempo Moderato Testnet (Chain ID 42431)
///         and seeds an isolated Demo Treasury + Mandate #1.
/// @dev Enforces DEMO_SPENDER == vm.addr(DEMO_RELAYER_PRIVATE_KEY) when seeding.
contract DeployMandateBookModerato is Script {
    address constant PATH_USD = 0x20C0000000000000000000000000000000000000;
    uint256 constant MODERATO_CHAIN_ID = 42431;

    function run() external {
        require(block.chainid == MODERATO_CHAIN_ID, "Wrong network: expected Tempo Moderato (42431)");

        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        uint256 seedDeposit = vm.envOr("DEMO_SEED_DEPOSIT", uint256(0));
        address demoSpender = deployer;

        if (seedDeposit > 0) {
            require(seedDeposit >= 2, "Seed deposit too small");
            require(seedDeposit / 2 <= type(uint128).max, "Seed deposit too large");

            uint256 relayerKey = vm.envUint("DEMO_RELAYER_PRIVATE_KEY");
            address relayerAddress = vm.addr(relayerKey);
            demoSpender = vm.envOr("DEMO_SPENDER", relayerAddress);
            require(
                demoSpender == relayerAddress,
                "DEMO_SPENDER must match DEMO_RELAYER_PRIVATE_KEY"
            );
        }

        address merchantHelios = vm.envOr("MERCHANT_HELIOS_ADDRESS", address(0));
        address merchantAtlas = vm.envOr("MERCHANT_ATLAS_ADDRESS", address(0));

        vm.startBroadcast(deployerKey);

        MandateBook book = new MandateBook(deployer);
        console2.log("MandateBook v2 deployed at:", address(book));
        console2.log("Owner / Initial Operator:", deployer);
        console2.log("Chain ID:", block.chainid);

        if (seedDeposit > 0) {
            bool approved = ITIP20(PATH_USD).approve(address(book), seedDeposit);
            require(approved, "pathUSD approval failed");

            book.deposit(PATH_USD, seedDeposit);
            console2.log("Deposited pathUSD (6 dec):", seedDeposit);

            uint128 spendMax = uint128(seedDeposit / 2);
            uint128 maxPerTx = spendMax < 1_000000
                ? spendMax
                : 1_000000; // Never exceed the mandate's total spend limit
            uint128 rateLimit = 5_000000; // 5.00 pathUSD per hour
            uint32 window = 3600;

            uint256 id = book.issue(
                demoSpender,
                PATH_USD,
                spendMax,
                maxPerTx,
                uint64(block.timestamp),
                uint64(block.timestamp + 30 days),
                rateLimit,
                window,
                keccak256("DEMO_AI_OPS")
            );
            console2.log("Issued Demo Mandate ID:", id);
            console2.log("Demo Spender (verified == Relayer):", demoSpender);

            if (merchantHelios != address(0)) {
                book.setMerchant(id, merchantHelios, true);
                console2.log("Allowlisted MERCHANT_HELIOS_ADDRESS:", merchantHelios);
            }
            if (merchantAtlas != address(0)) {
                book.setMerchant(id, merchantAtlas, true);
                console2.log("Allowlisted MERCHANT_ATLAS_ADDRESS:", merchantAtlas);
            }
        }

        vm.stopBroadcast();
    }
}
