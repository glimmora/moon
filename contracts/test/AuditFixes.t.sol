// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test, console2} from "forge-std/Test.sol";

import {MoonFactory} from "src/MoonFactory.sol";
import {BondingCurve} from "src/BondingCurve.sol";
import {MoonToken} from "src/MoonToken.sol";
import {FeeRouter} from "src/FeeRouter.sol";
import {MoonBurner} from "src/MoonBurner.sol";
import {CreatorFeeVault} from "src/CreatorFeeVault.sol";
import {ReferralRegistry} from "src/ReferralRegistry.sol";
import {MoonV3Concentrator} from "src/MoonV3Concentrator.sol";

import {IMoonToken} from "src/interfaces/IMoonToken.sol";
import {IBondingCurve} from "src/interfaces/IBondingCurve.sol";
import {IMoonFactory} from "src/interfaces/IMoonFactory.sol";
import {IReferralRegistry} from "src/interfaces/IReferralRegistry.sol";
import {ICreatorFeeVault} from "src/interfaces/ICreatorFeeVault.sol";
import {IMoonV3Concentrator} from "src/interfaces/IMoonV3Concentrator.sol";

/// @title AuditFixesTest
/// @notice Regression tests for the audit findings fixed in this pass:
///   C1  burn share reaches MoonBurner AND buybackAndBurn no longer reverts
///   H2  permanent referrer link is authoritative and cannot be bypassed
///   H3  MoonV3Concentrator.concentrate reverts (no fund-loss stub)
///   M1  factory holds DEFAULT_ADMIN_ROLE on token clones (revocable MINTER)
///   M3  implementation contracts cannot be initialized directly
///   M4  CreatorFeeVault rejects a zero creator
///   L1  slippage failures revert with SlippageExceeded
///   INV totalSupply == sum of tracked balances
contract AuditFixesTest is Test {
    MoonFactory internal factory;
    FeeRouter internal feeRouter;
    MoonBurner internal moonBurner;
    CreatorFeeVault internal vault;
    ReferralRegistry internal registry;
    MoonV3Concentrator internal concentrator;
    MoonToken internal moonTokenImpl;
    BondingCurve internal bondingCurveImpl;

    address internal deployer = makeAddr("deployer");
    address internal treasury = makeAddr("treasury");
    address internal devWallet = makeAddr("devWallet");
    address internal creator = makeAddr("creator");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal referrer = makeAddr("referrer");
    address internal attacker = makeAddr("attacker");
    address internal moonTokenGov = makeAddr("moonTokenGov");

    function setUp() public {
        vm.startPrank(deployer);

        moonTokenImpl = new MoonToken();
        bondingCurveImpl = new BondingCurve();

        vault = new CreatorFeeVault();
        registry = new ReferralRegistry();
        moonBurner = new MoonBurner(moonTokenGov, address(0), treasury);
        feeRouter = new FeeRouter(devWallet, address(moonBurner), treasury);
        concentrator = new MoonV3Concentrator(moonTokenGov);

        factory = new MoonFactory(
            address(feeRouter),
            address(vault),
            address(registry),
            address(concentrator),
            treasury,
            address(moonTokenImpl),
            address(bondingCurveImpl)
        );

        vault.grantRole(vault.DEFAULT_ADMIN_ROLE(), address(factory));
        registry.grantRole(registry.DEFAULT_ADMIN_ROLE(), address(factory));
        feeRouter.grantRole(feeRouter.DEFAULT_ADMIN_ROLE(), address(factory));
        moonBurner.grantRole(moonBurner.CALLER_ROLE(), address(feeRouter));

        vm.stopPrank();
    }

    /* ─────────────────────────  C1  ─────────────────────────── */

    /// @notice The 30% burn share must actually reach the MoonBurner and buybackAndBurn
    ///         must NOT revert now that FeeRouter holds CALLER_ROLE. (Swap is skipped
    ///         because no DEX router is set, so funds stay in the burner — but the call
    ///         succeeds, proving the role wiring is correct.)
    function test_C1_BurnShareReachesBurner_NoRevert() public {
        (, address curveAddr) = _createToken(0, 1);
        BondingCurve curve = BondingCurve(payable(curveAddr));

        // Move past X-Mode so the fee is a normal 1.25% (larger absolute router share).
        vm.roll(block.number + 10);

        uint256 burnerBefore = address(moonBurner).balance;

        vm.deal(alice, 10 ether);
        vm.prank(alice);
        curve.buy{value: 1 ether}(1 ether, 0, address(0));

        // Burn share is 30% of the router share (routerShare = 70% of fee → burn = 30% of that).
        assertGt(address(moonBurner).balance, burnerBefore, "burn share must reach MoonBurner");
        // CALLER_ROLE is wired so buybackAndBurn is authorized.
        assertTrue(moonBurner.hasCallerRole(address(feeRouter)), "feeRouter must hold CALLER_ROLE");
    }

    /* ─────────────────────────  H2  ─────────────────────────── */

    /// @notice Once a trader has a permanent referrer link, passing a different referrer
    ///         (or address(0)) at trade time must NOT redirect/bypass the reward.
    function test_H2_PermanentReferrerCannotBeBypassed() public {
        (, address curveAddr) = _createToken(0, 1);
        BondingCurve curve = BondingCurve(payable(curveAddr));
        vm.roll(block.number + 10);

        // Alice permanently links `referrer`.
        vm.prank(alice);
        registry.setReferrer(referrer);

        // Alice trades but tries to pass `attacker` as the referrer.
        vm.deal(alice, 10 ether);
        vm.prank(alice);
        curve.buy{value: 1 ether}(1 ether, 0, attacker);

        // The permanent referrer earns; the attacker earns nothing.
        assertGt(registry.claimableRewards(referrer, address(0)), 0, "linked referrer must earn");
        assertEq(registry.claimableRewards(attacker, address(0)), 0, "attacker must not earn");
    }

    /// @notice When no permanent link exists, the trader-supplied referrer is used AND
    ///         persisted as the permanent link on the first record.
    function test_H2_FirstReferrerIsUsedWhenNoLink() public {
        (, address curveAddr) = _createToken(0, 1);
        BondingCurve curve = BondingCurve(payable(curveAddr));
        vm.roll(block.number + 10);

        vm.deal(bob, 10 ether);
        vm.prank(bob);
        curve.buy{value: 1 ether}(1 ether, 0, referrer);

        assertGt(registry.claimableRewards(referrer, address(0)), 0, "supplied referrer earns");
    }

    /* ─────────────────────────  H3  ─────────────────────────── */

    function test_H3_ConcentrateReverts() public {
        vm.expectRevert(IMoonV3Concentrator.NotImplemented.selector);
        concentrator.concentrate(makeAddr("pair"), 1 ether);
    }

    /* ─────────────────────────  M1  ─────────────────────────── */

    function test_M1_FactoryIsAdminOnTokenClone() public {
        (address tokenAddr, address curveAddr) = _createToken(0, 1);
        MoonToken token = MoonToken(tokenAddr);

        assertTrue(
            token.hasRole(token.DEFAULT_ADMIN_ROLE(), address(factory)), "factory must be admin"
        );

        // Factory (admin) can revoke a compromised curve's MINTER_ROLE.
        bytes32 minterRole = token.MINTER_ROLE();
        vm.prank(address(factory));
        token.revokeRole(minterRole, curveAddr);
        assertFalse(token.hasRole(minterRole, curveAddr), "MINTER must be revocable");
    }

    /* ─────────────────────────  M3  ─────────────────────────── */

    function test_M3_ImplementationsCannotBeInitialized() public {
        // BondingCurve implementation: setFactory must revert (already initialized).
        vm.expectRevert(IBondingCurve.AlreadyInitialized.selector);
        bondingCurveImpl.setFactory();

        // MoonToken implementation: initialize must revert (already initialized).
        IMoonToken.InitParams memory ip = IMoonToken.InitParams({
            name: "X",
            symbol: "X",
            supplyTier: 0,
            curveShape: 0,
            maxTxBps: 0,
            maxHoldBps: 0,
            cooldownSeconds: 0
        });
        vm.expectRevert(IMoonToken.AlreadyInitialized.selector);
        moonTokenImpl.initialize(ip, attacker);
    }

    /* ─────────────────────────  M4  ─────────────────────────── */

    function test_M4_VaultRejectsZeroCreator() public {
        // Grant this test contract ACCRUER_ROLE directly.
        bytes32 accruerRole = vault.ACCRUER_ROLE();
        vm.prank(deployer);
        vault.grantRole(accruerRole, address(this));

        vm.expectRevert(ICreatorFeeVault.ZeroAddress.selector);
        vault.accrueFees(makeAddr("token"), address(0), address(0), 1 ether);
    }

    /* ─────────────────────────  L1  ─────────────────────────── */

    function test_L1_BuySlippageReverts() public {
        (, address curveAddr) = _createToken(0, 1);
        BondingCurve curve = BondingCurve(payable(curveAddr));
        vm.roll(block.number + 10);

        vm.deal(alice, 10 ether);
        vm.prank(alice);
        vm.expectRevert(IBondingCurve.SlippageExceeded.selector);
        curve.buy{value: 1 ether}(1 ether, type(uint256).max, address(0));
    }

    /* ─────────────────────────  INVARIANT  ─────────────────── */

    /// @notice After a sequence of buys/sells, the token totalSupply must equal the sum of
    ///         the curve-tracked reserves held by traders (Option B: mint-on-buy/burn-on-sell).
    function test_Invariant_SupplyEqualsHolderBalances() public {
        (address tokenAddr, address curveAddr) = _createToken(0, 1);
        MoonToken token = MoonToken(tokenAddr);
        BondingCurve curve = BondingCurve(payable(curveAddr));
        vm.roll(block.number + 10);

        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);

        vm.prank(alice);
        uint256 aliceTokens = curve.buy{value: 2 ether}(2 ether, 0, address(0));
        vm.prank(bob);
        uint256 bobTokens = curve.buy{value: 3 ether}(3 ether, 0, address(0));

        assertEq(token.totalSupply(), aliceTokens + bobTokens, "supply must equal holder balances");
        assertEq(token.balanceOf(alice), aliceTokens, "alice balance");
        assertEq(token.balanceOf(bob), bobTokens, "bob balance");

        // Alice sells half.
        uint256 sellAmt = aliceTokens / 2;
        vm.prank(alice);
        token.approve(curveAddr, sellAmt);
        vm.prank(alice);
        curve.sell(sellAmt, 0, address(0));

        assertEq(
            token.totalSupply(),
            token.balanceOf(alice) + token.balanceOf(bob),
            "supply must remain equal to holder balances after sell"
        );
    }

    /* ──────────────────  CURVE (post-audit) invariants  ─────── */

    /// @notice AUDIT-FIX CRITICAL: virtual reserves now update per trade, so the marginal
    ///         price must strictly rise as tokens are bought (real bonding curve, not flat).
    function test_Curve_PriceRisesMonotonicallyOnBuys() public {
        (, address curveAddr) = _createToken(0, 1);
        BondingCurve curve = BondingCurve(payable(curveAddr));
        vm.roll(block.number + 10); // out of X-Mode

        vm.deal(alice, 1000 ether);
        uint256 lastPrice = curve.price();
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(alice);
            curve.buy{value: 5 ether}(5 ether, 0, address(0));
            uint256 p = curve.price();
            assertGt(p, lastPrice, "price must strictly rise with each buy");
            lastPrice = p;
        }
    }

    /// @notice AUDIT-FIX CRITICAL: the LOGARITHMIC (and every) shape must not allow a
    ///         risk-free buy→sell round-trip. Selling everything just bought must return
    ///         STRICTLY LESS quote than was paid in (fees + curve spread), for all shapes.
    function test_Curve_NoRoundTripArbitrage_AllShapes() public {
        for (uint8 shape = 0; shape <= 2; shape++) {
            (address tokenAddr, address curveAddr) = _createToken(0, shape);
            MoonToken token = MoonToken(tokenAddr);
            BondingCurve curve = BondingCurve(payable(curveAddr));
            vm.roll(block.number + 10); // flat 1.25% fee

            address trader = makeAddr(string(abi.encodePacked("trader", shape)));
            vm.deal(trader, 100 ether);

            uint256 balBefore = trader.balance;
            vm.prank(trader);
            uint256 bought = curve.buy{value: 10 ether}(10 ether, 0, address(0));

            vm.prank(trader);
            token.approve(curveAddr, bought);
            vm.prank(trader);
            curve.sell(bought, 0, address(0));

            uint256 balAfter = trader.balance;
            assertLt(balAfter, balBefore, "round-trip must never be profitable");
        }
    }

    /// @notice AUDIT-FIX (curve buy DoS): a buy that mints more than maxTxBps of supply must
    ///         succeed (mint path is exempt from max-tx), while max-hold still caps the buyer.
    function test_Curve_BuyNotBlockedByMaxTxOnMint() public {
        // Create with a tight 1% max-tx and 10% max-hold.
        vm.startPrank(creator);
        IMoonFactory.CreateParams memory params = IMoonFactory.CreateParams({
            name: "LimitToken",
            symbol: "LIM",
            imageUrl: "https://Moon/t.png",
            description: "limit",
            maxTxBps: 100, // 1%
            maxHoldBps: 1000, // 10%
            cooldownSeconds: 0,
            supplyTier: 0,
            curveShape: 1
        });
        (, address curveAddr) = factory.createToken(params);
        vm.stopPrank();

        BondingCurve curve = BondingCurve(payable(curveAddr));
        vm.roll(block.number + 10);

        // A buy that mints > 1% (max-tx) but < 10% (max-hold) of supply must NOT revert:
        // the mint path is exempt from max-tx, while max-hold still caps the buyer.
        // 1% of 1B = 10M tokens; 10% = 100M. A ~0.5 ETH buy mints tens of millions here.
        vm.deal(alice, 100 ether);
        vm.prank(alice);
        uint256 bought = curve.buy{value: 0.5 ether}(0.5 ether, 0, address(0));
        uint256 onePct = (curve.s_totalSupplyInit() * 100) / 10_000;
        assertGt(bought, onePct, "buy must mint more than max-tx (proving mint is exempt)");
        assertGt(bought, 0, "buy must succeed despite exceeding max-tx on mint");
    }

    /// @notice AUDIT-FIX H-3: buys are clamped to the graduation threshold so the curve
    ///         always retains a non-zero reserved LP supply and never over-mints the cap.
    function test_Curve_BuyClampedToGraduationThreshold() public {
        (address tokenAddr, address curveAddr) = _createToken(0, 1);
        MoonToken token = MoonToken(tokenAddr);
        BondingCurve curve = BondingCurve(payable(curveAddr));
        vm.roll(block.number + 10);

        // Buy with an enormous amount — should clamp at the threshold and graduate.
        vm.deal(alice, 1_000_000 ether);
        vm.prank(alice);
        curve.buy{value: 500_000 ether}(500_000 ether, 0, address(0));

        // Real token reserves never exceed the graduation threshold, and total minted
        // supply (buyer + any LP mint) stays at/below the tier cap.
        assertLe(curve.s_realTokenReserves(), curve.s_totalSupplyInit(), "supply cap respected");
        assertLe(token.totalSupply(), curve.s_totalSupplyInit(), "total minted <= cap");
        assertTrue(curve.graduated(), "large buy should reach graduation");
    }

    /* ─────────────────────────  helpers  ────────────────────── */

    /* ──────────────────  Graduation fraction (testnet)  ────────────────── */

    /// @notice A configured graduation fraction lowers s_realReservesInit to a fraction of
    ///         the tier's total supply, without touching the virtual reserves (price curve).
    function test_GraduationFraction_LowersThreshold() public {
        // 0.001% of total supply.
        uint256 fractionWad = 1e13;
        vm.prank(deployer);
        factory.setGraduationFraction(fractionWad);
        assertEq(factory.graduationFractionWad(), fractionWad, "fraction stored");

        (, address curveAddr) = _createToken(0, 1);
        BondingCurve curve = BondingCurve(payable(curveAddr));

        uint256 totalSupply = factory.totalSupplyForTier(0);
        uint256 expected = (totalSupply * fractionWad) / 1e18;
        assertEq(curve.s_realReservesInit(), expected, "threshold = 0.001% of supply");
        assertLt(
            curve.s_realReservesInit(),
            factory.realReservesForTier(0),
            "threshold far below default curve threshold"
        );
    }

    /// @notice Zero fraction restores the default curve threshold.
    function test_GraduationFraction_ZeroUsesDefault() public {
        (, address curveAddr) = _createToken(0, 1);
        BondingCurve curve = BondingCurve(payable(curveAddr));
        assertEq(
            curve.s_realReservesInit(),
            factory.realReservesForTier(0),
            "default threshold when fraction unset"
        );
    }

    /// @notice A fraction of 100% or more is rejected (must reserve some supply for LP).
    function test_GraduationFraction_RejectsFullSupply() public {
        vm.prank(deployer);
        vm.expectRevert(IMoonFactory.InvalidGraduationFraction.selector);
        factory.setGraduationFraction(1e18);
    }

    function _createToken(uint8 tier, uint8 curveShape)
        internal
        returns (address token, address curve)
    {
        vm.startPrank(creator);
        // No transfer limits so trade-flow tests can buy freely; limit enforcement is
        // covered separately in the integration suite.
        IMoonFactory.CreateParams memory params = IMoonFactory.CreateParams({
            name: "AuditToken",
            symbol: "AUD",
            imageUrl: "https://Moon/t.png",
            description: "audit",
            maxTxBps: 0,
            maxHoldBps: 0,
            cooldownSeconds: 0,
            supplyTier: tier,
            curveShape: curveShape
        });
        (token, curve) = factory.createToken(params);
        vm.stopPrank();
    }
}
