// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IBondingCurve
/// @notice Interface for the multi-shape bonding curve that markets a single MoonToken.
/// @dev Cloned by MoonFactory. Price params: START_PRICE=270e9, END_PRICE=270e12.
interface IBondingCurve {
    /* ─────────────────────────  Enums  ────────────────────────── */

    enum CurveShape {
        LINEAR,
        EXPONENTIAL,
        LOGARITHMIC
    }

    /* ─────────────────────────  Errors  ───────────────────────── */

    error NotFactory();
    error NotInitialized();
    error AlreadyInitialized();
    error ZeroAmount();
    error ZeroAddress(); // AUDIT-FIX L-2
    error InsufficientQuote();
    error InsufficientTokens();
    error AlreadyGraduated();
    error NotGraduated();
    error RescueBlocked();

    /* ─────────────────────────  Events  ───────────────────────── */

    event __Init(address indexed token, address indexed quoteAsset, address indexed factory);
    event Bought(
        address indexed buyer,
        uint256 quoteIn,
        uint256 tokensOut,
        uint256 fee,
        uint256 priceAfter
    );
    event Sold(
        address indexed seller,
        uint256 tokensIn,
        uint256 quoteOut,
        uint256 fee,
        uint256 priceAfter
    );
    event Graduated(
        address indexed token,
        address indexed pair,
        uint256 lpAmount,
        uint256 tokenLiquidity,
        uint256 quoteLiquidity
    );
    event Rescued(address indexed token, address indexed to, uint256 amount);

    /* ─────────────────────────  Constants  ────────────────────── */

    function START_PRICE() external pure returns (uint256);
    function END_PRICE() external pure returns (uint256);
    function VIRTUAL_QUOTE_EXP_BASE() external pure returns (uint256);
    function VIRTUAL_TOKEN_EXP_BASE() external pure returns (uint256);
    function BASE_REAL_TOKEN_PER_1B() external pure returns (uint256);
    function BASE_TOTAL_SUPPLY_PER_1B() external pure returns (uint256);

    /* ─────────────────────────  Trade  ────────────────────────── */

    /// @notice Buy tokens with `quoteAmountIn` of the quote asset.
    /// @dev Mints tokens to `buyer` via IMoonToken.mint.
    function buy(uint256 quoteAmountIn, uint256 minTokensOut, address referrer) external payable returns (uint256 tokensOut);

    /// @notice Sell `tokenAmountIn` tokens for the quote asset.
    /// @dev CEI: effects → interactions → burnFrom LAST.
    // AUDIT-FIX H-1: Add referrer parameter to sell()
    function sell(uint256 tokenAmountIn, uint256 minQuoteOut, address referrer) external returns (uint256 quoteOut);

    /// @notice Graduate the token to DEX trading once threshold reached.
    function graduate() external;

    /* ─────────────────────────  Getters  ──────────────────────── */

    function token() external view returns (address);
    function quoteAsset() external view returns (address);
    function factory() external view returns (address);
    function feeRouter() external view returns (address);
    function creatorFeeVault() external view returns (address);
    function referralRegistry() external view returns (address);
    function dexRouter() external view returns (address);
    function dexPair() external view returns (address);
    function graduated() external view returns (bool);
    function creationBlock() external view returns (uint256);
    function s_realTokenReserves() external view returns (uint256);
    function s_realQuoteReserves() external view returns (uint256);
    function s_virtualTokenReserves() external view returns (uint256);
    function s_virtualQuoteReserves() external view returns (uint256);
    function s_totalSupplyInit() external view returns (uint256);

    /// @notice Current marginal price (quote per 1e18 token) on the curve.
    function price() external view returns (uint256);

    /// @notice Quote how many tokens `quoteAmountIn` buys.
    function getBuyOut(uint256 quoteAmountIn) external view returns (uint256 tokensOut, uint256 fee);

    /// @notice Quote how much quote `tokenAmountIn` sells for.
    function getSellOut(uint256 tokenAmountIn) external view returns (uint256 quoteOut, uint256 fee);
}
