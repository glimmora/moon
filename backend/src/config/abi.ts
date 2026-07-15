/**
 * ABIs used by the backend indexer. Kept as plain objects (not viem abis) for
 * serialization safety across the dynamic-import boundary.
 */
import { moonFactoryAbi } from "../../frontend/src/abi/MoonFactory.js";
import { bondingCurveAbi } from "../../frontend/src/abi/BondingCurve.js";
import { moonTokenAbi } from "../../frontend/src/abi/MoonToken.js";
import { creatorFeeVaultAbi } from "../../frontend/src/abi/CreatorFeeVault.js";
import { referralRegistryAbi } from "../../frontend/src/abi/ReferralRegistry.js";

export {
  moonFactoryAbi,
  bondingCurveAbi,
  moonTokenAbi,
  creatorFeeVaultAbi,
  referralRegistryAbi,
};
