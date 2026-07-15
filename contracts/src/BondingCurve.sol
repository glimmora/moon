// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";

import {IMoonToken} from "src/interfaces/IMoonToken.sol";
import {IBondingCurve} from "src/interfaces/IBondingCurve.sol";
import {IFeeRouter} from "src/interfaces/IFeeRouter.sol";
import {ICreatorFeeVault} from "src/interfaces/ICreatorFeeVault.sol";
import {IReferralRegistry} from "src/interfaces/IReferralRegistry.sol";
import {IUniswapV2Router02} from "src/interfaces/IUniswapV2Router02.sol";
import {IUniswapV2Factory} from "src/interfaces/IUniswapV2Factory.sol";
import {IUniswapV2Pair} from "src/interfaces/IUniswapV2Pair.sol";

/// @title BondingCurve
/// @notice Multi-shape bonding curve (Linear / Exponential / Logarithmic) for a single MoonToken.
/// @dev
///   • Option B: tokens minted on buy, burned on sell.
///   • sell() follows strict CEI: effects → interactions → burnFrom LAST.
///   • s_realQuoteReserves decremented by grossQuoteOut (pre-fee), not quoteOut.
///   • _distributeFee() wraps all 3 external calls in try/catch.
///   • _graduate() mints reserved supply (totalSupplyInit - realReservesInit) for LP,
///     wraps DEX addLiquidity in try/catch, burns LP to 0xdEaD.
///   • X-Mode anti-sniper: 99% fee block 0, decays to 1.25% by block 6.
contract BondingCurve is ReentrancyGuard, IBondingCurve {
    using SafeERC20 for IERC20;

    /* ───────────────────────  Constants  ──────────────────────── */

    /// @dev Marginal price bounds (quote per 1e18 token), 1e18 fixed point.
    uint256 public constant START_PRICE = 270_000_000; // 270e6
    uint256 public constant END_PRICE = 270_000_000_000; // 270e9

    /// @dev Virtual reserves for the EXPONENTIAL shape.
    uint256 public constant VIRTUAL_QUOTE_EXP_BASE = 30e18;
    uint256 public constant VIRTUAL_TOKEN_EXP_BASE = 1.073e27; // 1_073_000_000e18

    /// @dev Per-1B real token / total supply constants (1e18).
    uint256 public constant BASE_REAL_TOKEN_PER_1B = 793_100_000e18;
    uint256 public constant BASE_TOTAL_SUPPLY_PER_1B = 1_000_000_000e18;

    /// @dev X-Mode anti-sniper fee schedule (1e18 fixed point = fraction).
    uint256 private constant XMODE_FEE_B0 = 0.99e18; // 99% block 0
    uint256 private constant XMODE_FEE_MIN = 0.0125e18; // 1.25% final
    uint256 private constant XMODE_DECAY_BLOCKS = 6;

    /// @dev Standard trade fee once X-Mode expires.
    uint256 private constant BASE_FEE = 0.0125e18; // 1.25%

    /// @dev Creator + referral share of the fee (each), 1e18 fixed point.
    uint256 private constant CREATOR_FEE_SHARE = 0.20e18; // 20% of fee → creator
    uint256 private constant REFERRAL_FEE_SHARE = 0.10e18; // 10% of fee → referrer

    /// @dev Burn-it-all address.
    address private constant DEAD = 0x000000000000000000000000000000000000dEaD;

    /* ───────────────────────  Storage  ────────────────────────── */

    address private s_token;
    address private s_quoteAsset; // address(0) = native ETH
    address private s_factory;
    address private s_feeRouter;
    address private s_creatorFeeVault;
    address private s_referralRegistry;
    address private s_dexRouter;
    address private s_dexPair;
    bool private s_graduated;
    bool private s_initialized;
    uint256 public s_creationBlock; // solhint-disable-line var-name-mixedcase

    // Live reserves.
    uint256 public s_realTokenReserves;
    uint256 public s_realQuoteReserves;
    uint256 public s_virtualTokenReserves;
    uint256 public s_virtualQuoteReserves;

    /// @dev Cap supply for this token (1B/10B/100B), set on init.
    uint256 public s_totalSupplyInit;

    /// @dev Real token reserves at init (graduation threshold reference).
    uint256 private s_realReservesInit;

    /// @dev The curve shape for this clone.
    uint8 private s_curveShape;

    /// @dev Creator of this token (for fee accrual).
    address private s_creator;

    /* ───────────────────────  Init (factory-only)  ────────────── */

    /// @notice One-shot initializer invoked by the factory right after Clones.clone().
    /// @dev Sets reserves based on the supply tier + curve shape.
    function __init(
        address token,
        address quoteAsset,
        address creator,
        address feeRouter,
        address creatorFeeVault,
        address referralRegistry,
        address dexRouter,
        uint8 curveShape,
        uint256 totalSupplyInit,
        uint256 realTokenReservesInit,
        uint256 virtualTokenReservesInit,
        uint256 virtualQuoteReservesInit
    ) external {
        if (s_initialized) revert AlreadyInitialized();
        if (msg.sender != s_factory && s_factory == address(0)) {
            // First call bootstraps the factory pointer.
            s_factory = msg.sender;
        }
        if (msg.sender != s_factory) revert NotFactory();

        s_initialized = true;
        s_token = token;
        s_quoteAsset = quoteAsset;
        s_creator = creator;
        s_feeRouter = feeRouter;
        s_creatorFeeVault = creatorFeeVault;
        s_referralRegistry = referralRegistry;
        s_dexRouter = dexRouter;
        s_curveShape = curveShape;
        s_totalSupplyInit = totalSupplyInit;
        s_realReservesInit = realTokenReservesInit;
        s_creationBlock = block.number;

        s_realTokenReserves = 0;
        s_realQuoteReserves = 0;
        s_virtualTokenReserves = virtualTokenReservesInit;
        s_virtualQuoteReserves = virtualQuoteReservesInit;

        emit __Init(token, quoteAsset, s_factory);
    }

    /* ───────────────────────  Buy  ────────────────────────────── */

    /// @inheritdoc IBondingCurve
    function buy(uint256 quoteAmountIn, uint256 minTokensOut, address referrer)
        external
        payable
        override
        nonReentrant
        returns (uint256 tokensOut)
    {
        if (s_graduated) revert AlreadyGraduated();
        if (quoteAmountIn == 0) revert ZeroAmount();

        // Pull quote asset (native handled via msg.value).
        if (s_quoteAsset == address(0)) {
            if (msg.value != quoteAmountIn) revert InsufficientQuote();
        } else {
            if (msg.value != 0) revert InsufficientQuote();
            IERC20(s_quoteAsset).safeTransferFrom(msg.sender, address(this), quoteAmountIn);
        }

        uint256 fee;
        (tokensOut, fee) = _getBuyOut(quoteAmountIn);
        if (tokensOut < minTokensOut) revert InsufficientQuote();

        // ── Effects ──────────────────────────────────────────────
        s_realTokenReserves += tokensOut;
        s_realQuoteReserves += quoteAmountIn;

        // ── Interactions ─────────────────────────────────────────
        // 1) Mint tokens to the buyer (Option B).
        IMoonToken(s_token).mint(msg.sender, tokensOut);

        // 2) Distribute fees (all wrapped in try/catch internally).
        if (fee > 0) {
            _distributeFee(fee, referrer);
        }

        // Check graduation threshold.
        if (s_realTokenReserves >= s_realReservesInit && !s_graduated) {
            _graduate();
        }

        emit Bought(msg.sender, quoteAmountIn, tokensOut, fee, price());
    }

    /* ───────────────────────  Sell  ───────────────────────────── */

    /// @inheritdoc IBondingCurve
    /// @dev CEI: effects → interactions → burnFrom LAST.
    function sell(uint256 tokenAmountIn, uint256 minQuoteOut)
        external
        override
        nonReentrant
        returns (uint256 quoteOut)
    {
        if (s_graduated) revert AlreadyGraduated();
        if (tokenAmountIn == 0) revert ZeroAmount();

        (uint256 grossQuoteOut, uint256 fee, uint256 netQuoteOut) = _getSellOut(tokenAmountIn);
        quoteOut = netQuoteOut;
        if (quoteOut < minQuoteOut) revert InsufficientTokens();

        // ── Effects ──────────────────────────────────────────────
        // Decrement by GROSS quote out (pre-fee), per audited spec.
        s_realTokenReserves = s_realTokenReserves > tokenAmountIn
            ? s_realTokenReserves - tokenAmountIn
            : 0;
        s_realQuoteReserves = s_realQuoteReserves > grossQuoteOut
            ? s_realQuoteReserves - grossQuoteOut
            : 0;

        // ── Interactions ─────────────────────────────────────────
        // 1) Send quote to seller.
        if (s_quoteAsset == address(0)) {
            (bool ok,) = payable(msg.sender).call{value: quoteOut}("");
            if (!ok) revert InsufficientQuote();
        } else {
            IERC20(s_quoteAsset).safeTransfer(msg.sender, quoteOut);
        }

        // 2) Distribute fees (all try/catch).
        if (fee > 0) {
            _distributeFee(fee, address(0));
        }

        // 3) Burn seller tokens LAST (CEI).
        IMoonToken(s_token).burnFrom(msg.sender, tokenAmountIn);

        emit Sold(msg.sender, tokenAmountIn, quoteOut, fee, price());
    }

    /* ───────────────────────  Graduate  ───────────────────────── */

    /// @inheritdoc IBondingCurve
    function graduate() external override nonReentrant {
        if (s_graduated) revert AlreadyGraduated();
        if (s_realTokenReserves < s_realReservesInit) revert NotGraduated();
        _graduate();
    }

    /// @dev Mint the reserved supply (totalSupplyInit - realReservesInit), seed a Uniswap V2
    ///      pool with the real quote reserves + reserved tokens, then burn the LP to 0xdEaD.
    ///      DEX addLiquidity is wrapped in try/catch — failure does not revert the trade.
    function _graduate() internal {
        s_graduated = true;

        // Reserved tokens to mint for LP = totalSupplyInit - currentMinted.
        // currentMinted = s_realTokenReserves (everything minted so far lives in buyer wallets).
        uint256 reservedForLP = s_totalSupplyInit > s_realTokenReserves
            ? s_totalSupplyInit - s_realTokenReserves
            : 0;

        // Mint reserved tokens to this curve for LP provisioning.
        if (reservedForLP > 0) {
            IMoonToken(s_token).mint(address(this), reservedForLP);
        }

        // Approve DEX router.
        address router = s_dexRouter;
        address pair;

        if (router != address(0)) {
            // Create the pair if it doesn't exist.
            try IUniswapV2Factory(IUniswapV2Router02(router).factory()).createPair(s_token, s_quoteAsset)
            returns (address p) {
                pair = p;
            } catch {
                pair = IUniswapV2Factory(IUniswapV2Router02(router).factory()).getPair(s_token, s_quoteAsset);
            }
            s_dexPair = pair;

            if (pair != address(0)) {
                // Approve tokens.
                IMoonToken(s_token).approve(router, reservedForLP);
                if (s_quoteAsset != address(0)) {
                    IERC20(s_quoteAsset).approve(router, s_realQuoteReserves);
                }

                // Wrap addLiquidity in try/catch — failure is non-fatal.
                try IUniswapV2Router02(router).addLiquidity{value: s_quoteAsset == address(0) ? s_realQuoteReserves : 0}(
                    s_token,
                    s_quoteAsset,
                    reservedForLP,
                    s_realQuoteReserves,
                    0,
                    0,
                    address(this),
                    block.timestamp + 300
                ) returns (uint256, uint256, uint256 lpAmount) {
                    if (lpAmount > 0 && pair != address(0)) {
                        // Burn LP to 0xdEaD.
                        IUniswapV2Pair(pair).transfer(DEAD, lpAmount);
                        emit Graduated(s_token, pair, lpAmount, reservedForLP, s_realQuoteReserves);
                    }
                } catch {
                    // DEX addLiquidity failed — emit graduation without LP.
                    emit Graduated(s_token, pair, 0, reservedForLP, s_realQuoteReserves);
                }
            } else {
                emit Graduated(s_token, address(0), 0, reservedForLP, s_realQuoteReserves);
            }
        } else {
            emit Graduated(s_token, address(0), 0, reservedForLP, s_realQuoteReserves);
        }
    }

    /* ───────────────────────  Fee distribution  ───────────────── */

    /// @dev Distribute `feeAmount` of the quote asset across creator vault, referral registry,
    ///      and fee router. ALL three external calls are wrapped in try/catch so a single
    ///      failure never reverts the trade.
    function _distributeFee(uint256 feeAmount, address referrer) internal {
        address quote = s_quoteAsset;

        // Creator share.
        uint256 creatorShare = (feeAmount * CREATOR_FEE_SHARE) / 1e18;
        if (creatorShare > 0 && s_creatorFeeVault != address(0)) {
            // Fund the vault first.
            if (quote == address(0)) {
                (bool ok,) = payable(s_creatorFeeVault).call{value: creatorShare}("");
                ok; // best-effort funding
            } else {
                IERC20(quote).safeTransfer(s_creatorFeeVault, creatorShare);
            }
            try ICreatorFeeVault(s_creatorFeeVault).accrueFees(s_token, s_creator, quote, creatorShare) {
                // success — no-op
            } catch {
                // Non-blocking: fee simply not accrued.
            }
        }

        // Referral share (only if a referrer is linked for the trader).
        uint256 referralShare = (feeAmount * REFERRAL_FEE_SHARE) / 1e18;
        if (referrer != address(0) && referralShare > 0 && s_referralRegistry != address(0)) {
            address resolvedReferrer = referrer;
            try IReferralRegistry(s_referralRegistry).referrerOf(msg.sender) returns (address r) {
                if (r != address(0)) resolvedReferrer = r;
            } catch {
                // ignore — use passed referrer
            }
            // Fund the registry.
            if (quote == address(0)) {
                (bool ok,) = payable(s_referralRegistry).call{value: referralShare}("");
                ok;
            } else {
                IERC20(quote).safeTransfer(s_referralRegistry, referralShare);
            }
            try IReferralRegistry(s_referralRegistry).recordReferral(
                msg.sender,
                resolvedReferrer,
                s_token,
                feeAmount, // trade volume
                referralShare,
                quote
            ) {
                // success
            } catch {
                // Non-blocking.
            }
        }

        // Remaining share → FeeRouter (40% dev / 30% burn / 30% treasury).
        uint256 routerShare = feeAmount - creatorShare - referralShare;
        if (routerShare > 0 && s_feeRouter != address(0)) {
            if (quote == address(0)) {
                (bool ok,) = payable(s_feeRouter).call{value: routerShare}("");
                ok;
            } else {
                IERC20(quote).safeTransfer(s_feeRouter, routerShare);
            }
            try IFeeRouter(s_feeRouter).distribute(quote, routerShare) {
                // success
            } catch {
                // Non-blocking.
            }
        }
    }

    /* ───────────────────────  Pricing — buy  ──────────────────── */

    /// @dev Compute tokens out for a buy of `quoteAmountIn`.
    function _getBuyOut(uint256 quoteAmountIn) internal view returns (uint256 tokensOut, uint256 fee) {
        fee = _currentFee();
        uint256 quoteAfterFee = quoteAmountIn - (quoteAmountIn * fee) / 1e18;

        uint256 tokens = _buyTokenOut(quoteAfterFee);
        tokensOut = tokens;
    }

    /// @dev Curve-specific buy math.
    function _buyTokenOut(uint256 quoteIn) internal view returns (uint256) {
        uint256 vq = s_virtualQuoteReserves + quoteIn;
        // invariant: tokenOut = virtualToken * (1 - (virtualQuote / vq)^(shape-specific))
        if (s_curveShape == uint8(CurveShape.LINEAR)) {
            // Linear: tokenOut = virtualToken * (1 - sqrt(virtualQuote / vq))
            uint256 ratio = (s_virtualQuoteReserves * 1e36) / vq;
            uint256 sq = _sqrt(ratio);
            return (s_virtualTokenReserves * (1e18 - sq)) / 1e18;
        } else if (s_curveShape == uint8(CurveShape.EXPONENTIAL)) {
            // Exponential: tokenOut = virtualToken * (1 - (virtualQuote / vq))
            uint256 ratio = (s_virtualQuoteReserves * 1e18) / vq;
            return (s_virtualTokenReserves * (1e18 - ratio)) / 1e18;
        } else {
            // Logarithmic: tokenOut = virtualToken * (1 - pow1_5(virtualQuote / vq))
            uint256 ratio = (s_virtualQuoteReserves * 1e18) / vq;
            uint256 p = _pow1_5(ratio);
            return (s_virtualTokenReserves * (1e18 - p)) / 1e18;
        }
    }

    /* ───────────────────────  Pricing — sell  ─────────────────── */

    /// @dev Compute (grossQuoteOut, fee, netQuoteOut) for a sell of `tokenAmountIn`.
    function _getSellOut(uint256 tokenAmountIn)
        internal
        view
        returns (uint256 grossQuoteOut, uint256 fee, uint256 netQuoteOut)
    {
        fee = _currentFee();
        grossQuoteOut = _sellQuoteOut(tokenAmountIn);
        netQuoteOut = grossQuoteOut - (grossQuoteOut * fee) / 1e18;
    }

    /// @dev Curve-specific sell math.
    function _sellQuoteOut(uint256 tokensIn) internal view returns (uint256) {
        uint256 vt = s_virtualTokenReserves + tokensIn;
        if (s_curveShape == uint8(CurveShape.LINEAR)) {
            // Linear: quoteOut = virtualQuote * (1 - (virtualToken / vt)^2)
            uint256 ratio = (s_virtualTokenReserves * 1e18) / vt;
            uint256 sq = (ratio * ratio) / 1e18;
            return (s_virtualQuoteReserves * (1e18 - sq)) / 1e18;
        } else if (s_curveShape == uint8(CurveShape.EXPONENTIAL)) {
            // Exponential: quoteOut = virtualQuote * (1 - (virtualToken / vt))
            uint256 ratio = (s_virtualTokenReserves * 1e18) / vt;
            return (s_virtualQuoteReserves * (1e18 - ratio)) / 1e18;
        } else {
            // Logarithmic: quoteOut = virtualQuote * (1 - pow1_5(virtualToken / vt))
            uint256 ratio = (s_virtualTokenReserves * 1e18) / vt;
            uint256 p = _pow1_5(ratio);
            return (s_virtualQuoteReserves * (1e18 - p)) / 1e18;
        }
    }

    /* ───────────────────────  X-Mode fee  ─────────────────────── */

    /// @dev Anti-sniper fee: 99% block 0, linear decay to 1.25% by block 6, then flat 1.25%.
    function _currentFee() internal view returns (uint256) {
        uint256 elapsed = block.number - s_creationBlock;
        if (elapsed >= XMODE_DECAY_BLOCKS) {
            return BASE_FEE;
        }
        // Linear interpolation: fee = B0 - (B0 - MIN) * (elapsed / DECAY_BLOCKS)
        uint256 decay = ((XMODE_FEE_B0 - XMODE_FEE_MIN) * elapsed) / XMODE_DECAY_BLOCKS;
        return XMODE_FEE_B0 - decay;
    }

    /* ───────────────────────  Math helpers  ───────────────────── */

    /// @dev Babylonian square root (1e18 input → 1e9 output scaled; caller rescales).
    function _sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 r = x;
        uint256 t = (x + 1) / 2;
        while (t < r) {
            r = t;
            t = (x / t + t) / 2;
        }
        return r;
    }

    /// @dev x^1.5 in 1e18 fixed point via Newton's method (3 iterations).
    ///      Overflow-safe: input clamped to [0, 1e18].
    function _pow1_5(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        if (x == 1e18) return 1e18;
        // x^1.5 = x * sqrt(x). sqrt in 1e18 → result in 1e18.
        uint256 s = _sqrt1e18(x);
        return (x * s) / 1e18;
    }

    /// @dev sqrt for 1e18-fixed values → 1e18 result (Babylonian).
    function _sqrt1e18(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 r = x;
        // Newton: r = (r + x/r) / 2, but scale for 1e18.
        uint256 t = (x / 1e18 + 1) / 2 * 1e18;
        for (uint256 i = 0; i < 40; i++) {
            if (t >= r) break;
            r = t;
            t = ((x * 1e18) / t + t) / 2;
        }
        return r;
    }

    /* ───────────────────────  Price  ──────────────────────────── */

    /// @inheritdoc IBondingCurve
    function price() public view override returns (uint256) {
        // Marginal price = virtualQuoteReserves / virtualTokenReserves (1e18 fixed).
        if (s_virtualTokenReserves == 0) return START_PRICE;
        uint256 p = (s_virtualQuoteReserves * 1e18) / s_virtualTokenReserves;
        if (p < START_PRICE) return START_PRICE;
        if (p > END_PRICE) return END_PRICE;
        return p;
    }

    /// @inheritdoc IBondingCurve
    function getBuyOut(uint256 quoteAmountIn) external view override returns (uint256 tokensOut, uint256 fee) {
        return _getBuyOut(quoteAmountIn);
    }

    /// @inheritdoc IBondingCurve
    function getSellOut(uint256 tokenAmountIn) external view override returns (uint256 quoteOut, uint256 fee) {
        (quoteOut, fee,) = _getSellOut(tokenAmountIn);
    }

    /* ───────────────────────  Rescue  ─────────────────────────── */

    /// @notice Rescue non-token / non-quote assets sent by mistake. Blocks s_token + s_quoteAsset.
    /// @dev Supports native ETH (address(0)).
    function rescue(address token, address to, uint256 amount) external {
        if (msg.sender != s_factory) revert NotFactory();
        if (token == s_token) revert RescueBlocked();
        if (token == s_quoteAsset) revert RescueBlocked();
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

    function token() external view returns (address) {
        return s_token;
    }

    function quoteAsset() external view returns (address) {
        return s_quoteAsset;
    }

    function factory() external view returns (address) {
        return s_factory;
    }

    function feeRouter() external view returns (address) {
        return s_feeRouter;
    }

    function creatorFeeVault() external view returns (address) {
        return s_creatorFeeVault;
    }

    function referralRegistry() external view returns (address) {
        return s_referralRegistry;
    }

    function dexRouter() external view returns (address) {
        return s_dexRouter;
    }

    function dexPair() external view returns (address) {
        return s_dexPair;
    }

    function graduated() external view returns (bool) {
        return s_graduated;
    }

    function creationBlock() external view returns (uint256) {
        return s_creationBlock;
    }

    /// @dev Allow receiving native ETH (for native quote asset buys + rescue).
    receive() external payable {}
}
