// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Testnet USDC — 6 decimals like real USDC
contract MockUSDC is ERC20, Ownable {
    constructor() ERC20("USD Coin (Test)", "USDC") Ownable(msg.sender) {
        // Mint 1,000,000 USDC to deployer for testing
        _mint(msg.sender, 1_000_000 * 10 ** 6);
    }

    /// @notice Free faucet — anyone can mint up to 10,000 USDC for testing
    function faucet(address to, uint256 amount) external {
        require(amount <= 10_000 * 10 ** 6, "Max 10,000 USDC per faucet call");
        _mint(to, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
