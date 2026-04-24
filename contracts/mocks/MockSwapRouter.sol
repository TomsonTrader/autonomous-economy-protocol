// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IBurnable is IERC20 {}

/**
 * @dev Mock Uniswap V3 SwapRouter for tests.
 *      Accepts any ERC-20 as tokenIn and returns AGT at a fixed 1:1_000 rate
 *      (1 USDC micro-unit → 1000 AGT wei) to simulate a swap without a real pool.
 *      The caller must hold USDC; this contract must hold AGT.
 */
contract MockSwapRouter {
    address public immutable agt;

    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24  fee;
        address recipient;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }

    constructor(address _agt) {
        agt = _agt;
    }

    function exactInputSingle(ExactInputSingleParams calldata params)
        external
        returns (uint256 amountOut)
    {
        // Pull tokenIn (USDC) from the caller
        IERC20(params.tokenIn).transferFrom(msg.sender, address(this), params.amountIn);

        // Simulate price: 1 USDC micro-unit (1e-6 USDC) = 1000 AGT wei
        // e.g. 50 USDC = 50_000_000 micro-units → 50_000_000_000 AGT wei ≈ 50,000 AGT
        amountOut = params.amountIn * 1_000;

        require(amountOut >= params.amountOutMinimum, "MockRouter: slippage");
        IERC20(agt).transfer(params.recipient, amountOut);
    }
}
