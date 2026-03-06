// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Testnet USDC for World Chain — OracleX is a trusted operator (no approve needed)
/// @dev World App blocks approve() calls in mini apps. This token lets OracleX
///      call transferFrom without requiring an explicit approval.
contract MockUSDCWorld is ERC20, Ownable {
    address public immutable trustedOperator;

    constructor(address _trustedOperator) ERC20("USD Coin (World Test)", "USDC") Ownable(msg.sender) {
        trustedOperator = _trustedOperator;
        _mint(msg.sender, 1_000_000 * 10 ** 6);
    }

    /// @notice OracleX can transferFrom without approval; everyone else needs normal approval
    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        if (msg.sender == trustedOperator) {
            _transfer(from, to, amount);
            return true;
        }
        return super.transferFrom(from, to, amount);
    }

    /// @notice Returns max allowance for the trusted operator
    function allowance(address owner, address spender) public view override returns (uint256) {
        if (spender == trustedOperator) return type(uint256).max;
        return super.allowance(owner, spender);
    }

    function faucet(address to, uint256 amount) external {
        require(amount <= 10_000 * 10 ** 6, "Max 10,000 USDC per faucet call");
        _mint(to, amount);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
