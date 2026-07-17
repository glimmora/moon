// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

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
    uint256 private constant CREATOR_FEE_SHARE = 0.2e18; // 20% of fee → creator
    uint256 private constant REFERRAL_FEE_SHARE = 0.1e18; // 10% of fee → referrer

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

    /* ───────────────────────  Constructor  ────────────────────── */

    /// @dev AUDIT-FIX M3: mark the implementation as initialized so it can never be
    ///      bootstrapped/initialized directly. Only fresh clones (zeroed storage) are usable.
    constructor() {
        s_initialized = true;
    }

    /* ───────────────────────  Init (factory-only)  ────────────── */

    /// @notice One-shot factory bootstrap. Called by the MoonFactory immediately after
    ///         Clones.clone() and BEFORE __init(). AUDIT-FIX H-1: removes the prior
    ///         `s_factory == address(0)` auto-bootstrap path that allowed anyone to
    ///         become the factory on the very first call.
    /// @dev Can only be called once. Reverts if already set.
    function setFactory() external {
        // AUDIT-FIX M3: the implementation is constructed with s_initialized = true, so it
        // can never have its factory set; only fresh clones (zeroed storage) pass this.
        if (s_initialized) revert AlreadyInitialized();
        if (s_factory != address(0)) revert AlreadyInitialized();
        // The factory is the deployer of the implementation, but clones are
        // deployed by the factory too. We trust msg.sender on this one-shot call.
        s_factory = msg.sender;
    }

    /// @notice One-shot initializer invoked by the factory right after Clones.clone().
    /// @dev Sets reserves based on the supply tier + curve shape.
    ///      AUDIT-FIX H-1: Factory must be set via setFactory() BEFORE __init() is called.
    ///      The bootstrap path that allowed any caller to become the factory has been removed.
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
        // AUDIT-FIX H-1: s_factory MUST already be set (via setFactory) — no auto-bootstrap.
        if (s_factory == address(0)) revert NotFactory();
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

        // AUDIT-FIX H-3 (supply cap + non-empty LP): never mint past the graduation threshold.
        // Clamping tokensOut so s_realTokenReserves can reach — but not exceed — s_realReservesInit
        // guarantees reservedForLP = totalSupplyInit - realReservesInit > 0 at graduation, and
        // caps total minted supply below s_totalSupplyInit.
        uint256 remaining =
            s_realReservesInit > s_realTokenReserves ? s_realReservesInit - s_realTokenReserves : 0;
        if (remaining == 0) revert AlreadyGraduated();
        if (tokensOut > remaining) {
            tokensOut = remaining;
        }
        if (tokensOut < minTokensOut) revert SlippageExceeded();

        // AUDIT-FIX CRITICAL: `fee` returned by _getBuyOut is a FRACTION (1e18-based, e.g. 0.99e18 = 99%),
        // NOT an absolute amount. Compute the absolute fee amount here.
        uint256 feeAmount = (quoteAmountIn * fee) / 1e18;
        uint256 quoteAfterFee = quoteAmountIn - feeAmount;

        // ── Effects ──────────────────────────────────────────────
        s_realTokenReserves += tokensOut;
        // AUDIT-FIX H-2: Add quoteAfterFee (not quoteAmountIn) to reserves.
        // Fee is sent out via _distributeFee, so only the after-fee portion stays in the curve.
        s_realQuoteReserves += quoteAfterFee;
        // AUDIT-FIX CRITICAL (curve): move the virtual reserves along the constant-product
        // curve so the price actually rises with each buy and buy/sell remain exact inverses.
        // Previously the virtual reserves were static → flat price + LOG round-trip arbitrage.
        s_virtualQuoteReserves += quoteAfterFee;
        s_virtualTokenReserves -= tokensOut;

        // ── Interactions ─────────────────────────────────────────
        // 1) Mint tokens to the buyer (Option B).
        IMoonToken(s_token).mint(msg.sender, tokensOut);

        // 2) Distribute fees (all wrapped in try/catch internally).
        // AUDIT-FIX CRITICAL: pass feeAmount (absolute), not fee (fraction).
        if (feeAmount > 0) {
            _distributeFee(feeAmount, quoteAmountIn, referrer);
        }

        // Check graduation threshold.
        if (s_realTokenReserves >= s_realReservesInit && !s_graduated) {
            _graduate();
        }

        // AUDIT-FIX CRITICAL: emit feeAmount (absolute), not fee (fraction).
        emit Bought(msg.sender, quoteAmountIn, tokensOut, feeAmount, price());
    }

    /* ───────────────────────  Sell  ───────────────────────────── */

    /// @inheritdoc IBondingCurve
    /// @dev CEI: effects → interactions → burnFrom LAST.
    // AUDIT-FIX H-1: Accept referrer parameter
    function sell(uint256 tokenAmountIn, uint256 minQuoteOut, address referrer)
        external
        override
        nonReentrant
        returns (uint256 quoteOut)
    {
        if (s_graduated) revert AlreadyGraduated();
        if (tokenAmountIn == 0) revert ZeroAmount();

        (uint256 grossQuoteOut, uint256 fee, uint256 netQuoteOut) = _getSellOut(tokenAmountIn);
        quoteOut = netQuoteOut;
        if (quoteOut < minQuoteOut) revert SlippageExceeded();

        // AUDIT-FIX CRITICAL: `fee` is a FRACTION (1e18-based). Compute absolute fee amount.
        // The fee is taken from the GROSS quote out (before net deduction).
        uint256 feeAmount = (grossQuoteOut * fee) / 1e18;

        // ── Effects ──────────────────────────────────────────────
        // Decrement by GROSS quote out (pre-fee), per audited spec.
        s_realTokenReserves =
            s_realTokenReserves > tokenAmountIn ? s_realTokenReserves - tokenAmountIn : 0;
        s_realQuoteReserves =
            s_realQuoteReserves > grossQuoteOut ? s_realQuoteReserves - grossQuoteOut : 0;
        // AUDIT-FIX CRITICAL (curve): move the virtual reserves back along the constant-product
        // curve — the exact inverse of a buy. Tokens return to the curve, quote leaves it.
        s_virtualTokenReserves += tokenAmountIn;
        s_virtualQuoteReserves =
            s_virtualQuoteReserves > grossQuoteOut ? s_virtualQuoteReserves - grossQuoteOut : 0;

        // ── Interactions ─────────────────────────────────────────
        // 1) Send quote to seller.
        if (s_quoteAsset == address(0)) {
            (bool ok,) = payable(msg.sender).call{value: quoteOut}("");
            if (!ok) revert InsufficientQuote();
        } else {
            IERC20(s_quoteAsset).safeTransfer(msg.sender, quoteOut);
        }

        // 2) Distribute fees (all try/catch).
        // AUDIT-FIX H-1: Forward referrer to _distributeFee (was hardcoded address(0))
        // AUDIT-FIX CRITICAL: pass feeAmount (absolute), not fee (fraction).
        if (feeAmount > 0) {
            _distributeFee(feeAmount, grossQuoteOut, referrer);
        }

        // 3) Burn seller tokens LAST (CEI).
        IMoonToken(s_token).burnFrom(msg.sender, tokenAmountIn);

        // AUDIT-FIX CRITICAL: emit feeAmount (absolute), not fee (fraction).
        emit Sold(msg.sender, tokenAmountIn, quoteOut, feeAmount, price());
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
        uint256 reservedForLP =
            s_totalSupplyInit > s_realTokenReserves ? s_totalSupplyInit - s_realTokenReserves : 0;

        // Mint reserved tokens to this curve for LP provisioning.
        if (reservedForLP > 0) {
            IMoonToken(s_token).mint(address(this), reservedForLP);
        }

        // Approve DEX router.
        address router = s_dexRouter;
        address pair;

        if (router != address(0)) {
            // Create the pair if it doesn't exist.
            try IUniswapV2Factory(IUniswapV2Router02(router).factory())
                .createPair(s_token, s_quoteAsset) returns (
                address p
            ) {
                pair = p;
            } catch {
                pair = IUniswapV2Factory(IUniswapV2Router02(router).factory())
                    .getPair(s_token, s_quoteAsset);
            }
            s_dexPair = pair;

            if (pair != address(0)) {
                // Approve tokens.
                IERC20(address(s_token)).forceApprove(router, reservedForLP);
                if (s_quoteAsset != address(0)) {
                    IERC20(s_quoteAsset).forceApprove(router, s_realQuoteReserves);
                }

                // Wrap addLiquidity in try/catch — failure is non-fatal.
                try IUniswapV2Router02(router)
                .addLiquidity{value: s_quoteAsset == address(0) ? s_realQuoteReserves : 0}(
                    s_token,
                    s_quoteAsset,
                    reservedForLP,
                    s_realQuoteReserves,
                    0,
                    0,
                    address(this),
                    block.timestamp + 300
                ) returns (
                    uint256, uint256, uint256 lpAmount
                ) {
                    if (lpAmount > 0 && pair != address(0)) {
                        // Burn LP to 0xdEaD — check return value to confirm the burn succeeded.
                        bool burned = IUniswapV2Pair(pair).transfer(DEAD, lpAmount);
                        if (burned) {
                            emit Graduated(
                                s_token, pair, lpAmount, reservedForLP, s_realQuoteReserves
                            );
                        } else {
                            emit Graduated(s_token, pair, 0, reservedForLP, s_realQuoteReserves);
                        }
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
    function _distributeFee(uint256 feeAmount, uint256 tradeVolume, address referrer) internal {
        address quote = s_quoteAsset;

        // Creator share.
        uint256 creatorShare = (feeAmount * CREATOR_FEE_SHARE) / 1e18;
        if (creatorShare > 0 && s_creatorFeeVault != address(0)) {
            // Fund the vault first.
            // AUDIT-FIX M-3: Check ETH transfer result instead of ignoring
            if (quote == address(0)) {
                (bool ok,) = payable(s_creatorFeeVault).call{value: creatorShare}("");
                if (!ok) creatorShare = 0; // skip accrue if funding failed
            } else {
                IERC20(quote).safeTransfer(s_creatorFeeVault, creatorShare);
            }
            try ICreatorFeeVault(s_creatorFeeVault)
                .accrueFees(s_token, s_creator, quote, creatorShare) {
            // success — no-op
            }
                catch {
                // Non-blocking: fee simply not accrued.
            }
        }

        // Referral share. AUDIT-FIX H2: the permanent on-chain link (referrerOf) is
        // AUTHORITATIVE. The trader-supplied `referrer` is only used to establish a link
        // when none exists yet — it can never override an existing permanent link. This
        // prevents a trader from bypassing / redirecting a referrer they previously linked.
        uint256 referralShare = (feeAmount * REFERRAL_FEE_SHARE) / 1e18;
        if (referralShare > 0 && s_referralRegistry != address(0)) {
            // Resolve the AUTHORITATIVE permanent link first; only fall back to the
            // trader-supplied referrer when no permanent link exists yet.
            address resolvedReferrer;
            try IReferralRegistry(s_referralRegistry).referrerOf(msg.sender) returns (address r) {
                resolvedReferrer = r != address(0) ? r : referrer;
            } catch {
                resolvedReferrer = referrer;
            }
            // Nothing to pay if there is still no referrer.
            if (resolvedReferrer == address(0)) {
                referralShare = 0;
            } else {
                // Fund the registry.
                // AUDIT-FIX M-3: Check ETH transfer result
                if (quote == address(0)) {
                    (bool ok,) = payable(s_referralRegistry).call{value: referralShare}("");
                    if (!ok) referralShare = 0;
                } else {
                    IERC20(quote).safeTransfer(s_referralRegistry, referralShare);
                }
                try IReferralRegistry(s_referralRegistry)
                    .recordReferral(
                        msg.sender,
                        resolvedReferrer,
                        s_token,
                        tradeVolume, // actual trade volume
                        referralShare,
                        quote
                    ) {
                // success
                }
                    catch {
                    // Non-blocking.
                }
            }
        }

        // Remaining share → FeeRouter (40% dev / 30% burn / 30% treasury).
        uint256 routerShare = feeAmount - creatorShare - referralShare;
        if (routerShare > 0 && s_feeRouter != address(0)) {
            // AUDIT-FIX CRITICAL: For native ETH, call distribute WITH {value: routerShare}
            // so feeRouter.distribute's `require(msg.value == amount)` check passes.
            // For ERC-20, transfer first then call distribute (which pulls via transferFrom).
            if (quote == address(0)) {
                try IFeeRouter(s_feeRouter).distribute{value: routerShare}(quote, routerShare) {
                // success
                }
                    catch {
                    // Non-blocking: ETH stays in curve for rescue.
                }
            } else {
                // AUDIT-FIX C3: FeeRouter.distribute pulls via safeTransferFrom, so the curve
                // must APPROVE the router (not pre-transfer). Pre-transferring then relying on
                // transferFrom double-handles funds and always reverts (curve never approved).
                IERC20(quote).forceApprove(s_feeRouter, routerShare);
                try IFeeRouter(s_feeRouter).distribute(quote, routerShare) {
                // success
                }
                catch {
                    // Non-blocking: reset approval so no dangling allowance remains.
                    IERC20(quote).forceApprove(s_feeRouter, 0);
                }
            }
        }
    }

    /* ───────────────────────  Pricing — buy  ──────────────────── */

    /// @dev Compute tokens out for a buy of `quoteAmountIn`.
    function _getBuyOut(uint256 quoteAmountIn)
        internal
        view
        returns (uint256 tokensOut, uint256 fee)
    {
        fee = _currentFee();
        uint256 quoteAfterFee = quoteAmountIn - (quoteAmountIn * fee) / 1e18;

        uint256 tokens = _buyTokenOut(quoteAfterFee);
        tokensOut = tokens;
    }

    /// @dev Constant-product buy math: `tokenOut = vToken - k/(vQuote + quoteIn)`.
    ///      AUDIT-FIX CRITICAL: previously the three shapes used asymmetric closed-form
    ///      approximations (sqrt / linear / pow1.5). The LOGARITHMIC form was NOT the inverse
    ///      of its sell counterpart, which allowed a risk-free buy→sell round-trip that drained
    ///      the curve. A single constant-product invariant (x·y=k) is symmetric by construction
    ///      for every shape, so buy and sell are always exact inverses. The three shapes remain
    ///      distinct via their initial virtual-reserve ratios (set by the factory), which give
    ///      each a different starting price and steepness.
    function _buyTokenOut(uint256 quoteIn) internal view returns (uint256) {
        uint256 vQuote = s_virtualQuoteReserves;
        uint256 vToken = s_virtualTokenReserves;
        // k = vQuote * vToken (constant). After adding quoteIn, tokenOut keeps k invariant:
        //   (vQuote + quoteIn) * (vToken - tokenOut) = vQuote * vToken
        //   tokenOut = vToken - (vQuote * vToken) / (vQuote + quoteIn)
        //            = vToken * quoteIn / (vQuote + quoteIn)
        uint256 newVQuote = vQuote + quoteIn;
        uint256 tokenOut = (vToken * quoteIn) / newVQuote;
        // Never sell more tokens than remain in the virtual pool.
        if (tokenOut >= vToken) return vToken - 1;
        return tokenOut;
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

    /// @dev Constant-product sell math — the exact inverse of `_buyTokenOut`:
    ///      `quoteOut = vQuote - k/(vToken + tokensIn) = vQuote * tokensIn / (vToken + tokensIn)`.
    ///      AUDIT-FIX CRITICAL: symmetric with the buy side for all shapes (see _buyTokenOut).
    function _sellQuoteOut(uint256 tokensIn) internal view returns (uint256) {
        uint256 vQuote = s_virtualQuoteReserves;
        uint256 vToken = s_virtualTokenReserves;
        uint256 newVToken = vToken + tokensIn;
        uint256 quoteOut = (vQuote * tokensIn) / newVToken;
        if (quoteOut >= vQuote) return vQuote - 1;
        return quoteOut;
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

    /* ───────────────────────  Price  ──────────────────────────── */

    /// @inheritdoc IBondingCurve
    function price() public view override returns (uint256) {
        // Marginal price = virtualQuoteReserves / virtualTokenReserves, expressed as
        // quote-wei per 1e18 token (1e18 fixed point). This is the derivative of the
        // curve at the current reserves and is consistent with _buyTokenOut/_sellQuoteOut
        // which operate on the same virtual-reserve ratios. Virtual reserves scale
        // proportionally with the supply tier (both quote and token ×tierMultiplier), so
        // the ratio — and therefore these absolute START/END clamps — are tier-invariant.
        if (s_virtualTokenReserves == 0) return START_PRICE;
        uint256 p = (s_virtualQuoteReserves * 1e18) / s_virtualTokenReserves;
        if (p < START_PRICE) return START_PRICE;
        if (p > END_PRICE) return END_PRICE;
        return p;
    }

    /// @inheritdoc IBondingCurve
    function getBuyOut(uint256 quoteAmountIn)
        external
        view
        override
        returns (uint256 tokensOut, uint256 fee)
    {
        return _getBuyOut(quoteAmountIn);
    }

    /// @inheritdoc IBondingCurve
    function getSellOut(uint256 tokenAmountIn)
        external
        view
        override
        returns (uint256 quoteOut, uint256 fee)
    {
        (, fee, quoteOut) = _getSellOut(tokenAmountIn);
    }

    /* ───────────────────────  Rescue  ─────────────────────────── */

    /// @notice Rescue non-token / non-quote assets sent by mistake. Blocks s_token + s_quoteAsset.
    /// @dev Supports native ETH (address(0)).
    ///      AUDIT-FIX M-4: After graduation, if the DEX addLiquidity call failed, the curve
    ///      may still hold minted reserved tokens + quote reserves. The factory can recover
    ///      these via rescueGraduation() — NOT via this function (s_token / s_quoteAsset
    ///      remain blocked here to prevent draining live reserves).
    function rescue(address token, address to, uint256 amount) external {
        if (msg.sender != s_factory) revert NotFactory();
        if (token == s_token) revert RescueBlocked();
        if (token == s_quoteAsset) revert RescueBlocked();
        // AUDIT-FIX L-2: Use correct error name
        if (to == address(0)) revert ZeroAddress();

        if (token == address(0)) {
            (bool ok,) = payable(to).call{value: amount}("");
            require(ok, "transfer failed");
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
        emit Rescued(token, to, amount);
    }

    /// @notice Recover minted-but-unused reserved tokens + leftover quote reserves after a
    ///         graduation where DEX addLiquidity failed. AUDIT-FIX M-4.
    /// @dev Only callable by the factory, and ONLY after s_graduated == true. The recovered
    ///      token + quote are sent to `to` (typically the FeeRouter or treasury) so they are
    ///      not permanently stuck. This is a one-shot recovery — once called, all s_real*
    ///      reserves are zeroed.
    function rescueGraduation(address to) external {
        if (msg.sender != s_factory) revert NotFactory();
        if (!s_graduated) revert NotGraduated();
        if (to == address(0)) revert ZeroAddress();

        // Send any remaining s_token balance (minted reserved tokens that never reached the DEX).
        uint256 tokenBal = IERC20(s_token).balanceOf(address(this));
        if (tokenBal > 0) {
            IERC20(s_token).safeTransfer(to, tokenBal);
        }

        // Send any remaining quote asset.
        uint256 quoteBal = s_quoteAsset == address(0)
            ? address(this).balance
            : IERC20(s_quoteAsset).balanceOf(address(this));
        if (quoteBal > 0) {
            if (s_quoteAsset == address(0)) {
                (bool ok,) = payable(to).call{value: quoteBal}("");
                require(ok, "native transfer failed");
            } else {
                IERC20(s_quoteAsset).safeTransfer(to, quoteBal);
            }
        }

        // Zero the reserves so the accounting is honest.
        s_realTokenReserves = 0;
        s_realQuoteReserves = 0;

        emit Rescued(s_token, to, tokenBal);
        emit Rescued(s_quoteAsset, to, quoteBal);
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
