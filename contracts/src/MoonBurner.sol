// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IMoonBurner} from "src/interfaces/IMoonBurner.sol";
import {IUniswapV2Router02} from "src/interfaces/IUniswapV2Router02.sol";

/// @title MoonBurner
/// @notice Buyback-and-burn engine for the $MOON governance token.
/// @dev Only the FeeRouter (CALLER_ROLE) may call buybackAndBurn. The actual swap is
///      performed via an external self-call (`_executeSwap`) wrapped in try/catch so a
///      failing swap never reverts the FeeRouter distribution.
contract MoonBurner is AccessControl, Pausable, IMoonBurner {
    using SafeERC20 for IERC20;

    /* ───────────────────────  Errors  ────────────────────────── */
    error ZeroAddress();

    /* ───────────────────────  Roles  ──────────────────────────── */

    bytes32 public constant CALLER_ROLE = keccak256("CALLER_ROLE");
    bytes32 private constant ADMIN_ROLE = DEFAULT_ADMIN_ROLE;
    bytes32 private constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    /* ───────────────────────  Storage  ────────────────────────── */

    address public moonToken; // i_moonToken — blocked from rescue
    address public dexRouter;
    address public treasury;

    /* ───────────────────────  Constructor  ────────────────────── */

    constructor(address moonToken_, address dexRouter_, address treasury_) {
        if (moonToken_ == address(0) || treasury_ == address(0)) revert ZeroAddress();
        moonToken = moonToken_;
        dexRouter = dexRouter_;
        treasury = treasury_;
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(PAUSER_ROLE, msg.sender);
    }

    /* ───────────────────────  Core  ───────────────────────────── */

    /// @inheritdoc IMoonBurner
    function buybackAndBurn(address quoteAsset, uint256 quoteAmount)
        external
        override
        onlyRole(CALLER_ROLE)
        whenNotPaused
        returns (uint256 moonBurned)
    {
        if (quoteAmount == 0) revert ZeroAmount();

        // External self-call so a failing swap is caught by try/catch and never reverts
        // the FeeRouter distribution.
        try this._executeSwap(quoteAsset, quoteAmount) returns (uint256 bought) {
            moonBurned = bought;
            if (bought > 0) {
                // Burn the bought $MOON.
                IERC20(moonToken).safeTransfer(0x000000000000000000000000000000000000dEaD, bought);
                emit BuybackAndBurn(quoteAmount, bought, bought);
            }
        } catch {
            // Swap failed — skip this buyback. Funds stay for next attempt.
            emit BuybackSkipped(quoteAmount, "swap failed");
            moonBurned = 0;
        }
    }

    /// @notice External swap executor. Only callable by `address(this)` (self-call).
    /// @dev Splits the swap path so the parent can wrap it in try/catch.
    function _executeSwap(address quoteAsset, uint256 quoteAmount)
        external
        returns (uint256 moonBought)
    {
        if (msg.sender != address(this)) revert NotCaller();
        if (dexRouter == address(0)) {
            emit BuybackSkipped(quoteAmount, "no router");
            return 0;
        }

        address[] memory path = new address[](2);
        path[0] = quoteAsset == address(0) ? IUniswapV2Router02(dexRouter).WETH() : quoteAsset;
        path[1] = moonToken;

        // Approve router.
        if (quoteAsset != address(0)) {
            IERC20(quoteAsset).forceApprove(dexRouter, quoteAmount);
        }

        uint256 moonBefore = IERC20(moonToken).balanceOf(address(this));

        try IUniswapV2Router02(dexRouter).swapExactTokensForTokens{value: quoteAsset == address(0) ? quoteAmount : 0}(
            quoteAmount,
            0,
            path,
            address(this),
            block.timestamp + 300
        ) returns (uint256[] memory amounts) {
            moonBought = amounts[amounts.length - 1];
        } catch {
            if (quoteAsset == address(0)) {
                // Refund native to treasury on failure.
                (bool ok,) = payable(treasury).call{value: quoteAmount}("");
                ok;
            }
            moonBought = 0;
        }

        // Ensure we account for actual balance delta (defensive).
        uint256 moonAfter = IERC20(moonToken).balanceOf(address(this));
        if (moonAfter > moonBefore) {
            moonBought = moonAfter - moonBefore;
        }
    }

    /* ───────────────────────  Admin  ──────────────────────────── */

    function pause() external override onlyRole(PAUSER_ROLE) {
        _pause();
        emit Paused(msg.sender);
    }

    function unpause() external override onlyRole(PAUSER_ROLE) {
        _unpause();
        emit Unpaused(msg.sender);
    }

    function setDexRouter(address router) external onlyRole(ADMIN_ROLE) {
        dexRouter = router;
    }

    /// @inheritdoc IMoonBurner
    function rescue(address token, address to, uint256 amount) external override onlyRole(ADMIN_ROLE) {
        if (token == moonToken) revert RescueBlocked();
        if (to == address(0)) revert ZeroAmount();
        if (token == address(0)) {
            (bool ok,) = payable(to).call{value: amount}("");
            require(ok, "transfer failed");
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
        emit Rescued(token, to, amount);
    }

    /* ───────────────────────  Getters  ────────────────────────── */

    function hasCallerRole(address account) external view returns (bool) {
        return hasRole(CALLER_ROLE, account);
    }

    /// @inheritdoc IMoonBurner
    function paused() public view override(Pausable, IMoonBurner) returns (bool) {
        return Pausable.paused();
    }

    /// @dev Accept native ETH.
    receive() external payable {}
}
