// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IUniswapV2Factory
/// @notice Minimal Uniswap V2 Factory interface.
interface IUniswapV2Factory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
    function createPair(address tokenA, address tokenB) external returns (address pair);
    function feeTo() external view returns (address);
    function feeToSetter() external view returns (address);
}
