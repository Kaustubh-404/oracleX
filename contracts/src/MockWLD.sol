// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Testnet WLD — 18 decimals like real WLD
contract MockWLD is ERC20, Ownable {
    constructor() ERC20("Worldcoin (Test)", "WLD") Ownable(msg.sender) {
        _mint(msg.sender, 1_000_000 * 10 ** 18);
    }

    /// @notice Free faucet — anyone can mint up to 10,000 WLD for testing
    function faucet(address to, uint256 amount) external {
        require(amount <= 10_000 * 10 ** 18, "Max 10,000 WLD per faucet call");
        _mint(to, amount);
    }
}
