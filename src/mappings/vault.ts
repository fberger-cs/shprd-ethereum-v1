import {
	Factory,
	Vault,
	Deposit,
	Rebalance,
	Redeem,
	HarvestPerformanceFees,
	HarvestManagementFees,
} from "../types/schema";
import { newSnapshot, updateVault } from "./factory";
import {
	Vault as VaultContract,
	Deposit as DepositEvent,
	Rebalance as RebalanceEvent,
	Redeem as RedeemEvent,
	HarvestManagementFees as HarvestManagementFeesEvent,
	HarvestPerformanceFees as HarvestPerformanceFeesEvent,
	AddAsset as AddAssetEvent,
	RoleAdminChanged,
	RoleGranted,
	RoleRevoked,
} from "../types/Factory/Vault";
import { Address, BigInt, Bytes, log } from "@graphprotocol/graph-ts";
import { FACTORY_ADDRESS } from "./helpers";
import { SetShareTransferability, SetSecurityProps, SetConfigProps, SetFeesProps } from '../types/templates/Vault/Vault';

export function handleDeposit(event: DepositEvent): void {
	// load
	const factory = Factory.load(FACTORY_ADDRESS);

	// prevent error
	if (factory === null) return;

	// load
	const vault = Vault.load(event.address.toHexString());

	// prevent error
	if (vault == null) return;

	// load
	const deposit = new Deposit(event.transaction.hash.toHexString()) as Deposit;

	// source event data
	deposit.vault = vault.id;
	deposit.from = event.transaction.from;
	deposit.sharesMinted = event.params.sharesMinted;
	deposit.baseTokenAmountIn = event.params.baseTokenAmountIn;
	deposit.timestamp = event.block.timestamp;

	// source vault data
	const vaultContract = VaultContract.bind(event.address);
	const vaultStatusAfter = vaultContract.getVaultStatus();
	deposit.sharePriceAfter = vaultStatusAfter.value2;

	// save event
	deposit.save();

	// state
	vault.depositsCount = vault.depositsCount + 1;

	// save vault
	vault.save();

	// -
	newSnapshot(factory, Address.fromString(vault.id), event.block, true);

	// -
	updateVault(vault);
}

export function handleRebalance(event: RebalanceEvent): void {
	// load
	const factory = Factory.load(FACTORY_ADDRESS);

	// prevent error
	if (factory === null) return;

	// load
	const vault = Vault.load(event.address.toHexString());

	// prevent error
	if (vault == null) return;

	// load
	const newRebalance = new Rebalance(event.transaction.hash.toHexString()) as Rebalance;

	// source event data
	newRebalance.vault = vault.id;
	newRebalance.from = event.transaction.from;
	newRebalance.currentSignals = event.params.currentSignals;
	newRebalance.desiredSignals = event.params.desiredSignals;
	newRebalance.timestamp = event.block.timestamp;

	// source vault data
	const vaultContract = VaultContract.bind(event.address);
	const vaultStatusAfter = vaultContract.getVaultStatus();
	newRebalance.recordedSignals = vaultStatusAfter.value0;
	newRebalance.sharePriceAfter = vaultStatusAfter.value2;

	// save
	newRebalance.save();

	// state
	vault.rebalancesCount = vault.rebalancesCount + 1;

	// save
	vault.save();

	// -
	newSnapshot(factory, Address.fromString(vault.id), event.block, true);

	// -
	updateVault(vault);
}

// How to compute exit fees ?
export function handleRedeem(event: RedeemEvent): void {
	// load
	const factory = Factory.load(FACTORY_ADDRESS);

	// prevent error
	if (factory === null) return;

	// load
	const vault = Vault.load(event.address.toHexString());

	// prevent error
	if (vault == null) return;

	// load
	const newRedeem = new Redeem(event.transaction.hash.toHexString()) as Redeem;

	// source event data
	newRedeem.vault = vault.id;
	newRedeem.from = event.transaction.from;
	newRedeem.shareBurned = event.params.shareBurned;
	newRedeem.amountReceived = event.params.amountReceived;
	newRedeem.timestamp = event.block.timestamp;

	// source vault data
	const vaultContract = VaultContract.bind(event.address);
	const vaultStatusAfter = vaultContract.getVaultStatus();
	newRedeem.sharePriceAfter = vaultStatusAfter.value2;

	// save
	newRedeem.save();

	// state
	vault.redemptionsCount = vault.redemptionsCount + 1;

	// save
	vault.save();

	// -
	newSnapshot(factory, Address.fromString(vault.id), event.block, true);

	// -
	updateVault(vault);
}

export function handleHarvestManagementFees(event: HarvestManagementFeesEvent): void {
	// load
	const factory = Factory.load(FACTORY_ADDRESS);

	// prevent error
	if (factory === null) return;

	// load
	const vault = Vault.load(event.address.toHexString());

	// prevent error
	if (vault == null) return;

	// load
	const newManagementFeesHarvest = new HarvestManagementFees(event.transaction.hash.toHexString());

	// source event data
	const feesToDAO = event.params.amountToDAO;
	const feesToStrategist = event.params.amountToStrategist;
	newManagementFeesHarvest.from = event.transaction.from;
	newManagementFeesHarvest.amountToDAO = feesToDAO;
	newManagementFeesHarvest.amountToStrategist = feesToStrategist;
	newManagementFeesHarvest.timestamp = event.block.timestamp;

	// source vault data
	newManagementFeesHarvest.vault = vault.id;
	vault.accManagementFeesToDAO = vault.accManagementFeesToDAO.plus(feesToDAO);
	vault.accManagementFeesToStrategists = vault.accManagementFeesToStrategists.plus(feesToStrategist);

	// save
	newManagementFeesHarvest.save();
	vault.save();

	// -
	newSnapshot(factory, Address.fromString(vault.id), event.block, true);

	// -
	updateVault(vault);
}

export function handleHarvestPerformanceFees(event: HarvestPerformanceFeesEvent): void {
	// load
	const factory = Factory.load(FACTORY_ADDRESS);

	// prevent error
	if (factory === null) return;

	// load
	const vault = Vault.load(event.address.toHexString());

	// prevent error
	if (vault == null) return;

	// load
	const newPerformanceFeesHarvest = new HarvestPerformanceFees(event.transaction.hash.toHexString());

	// source event data
	const feesToDAO = event.params.amountToDAO;
	const feesToStrategist = event.params.amountToStrategist;
	newPerformanceFeesHarvest.vault = vault.id;
	newPerformanceFeesHarvest.from = event.transaction.from;
	newPerformanceFeesHarvest.amountToDAO = feesToDAO;
	newPerformanceFeesHarvest.amountToStrategist = feesToStrategist;
	newPerformanceFeesHarvest.timestamp = event.block.timestamp;

	// source vault data
	vault.accPerformanceFeesToDAO = vault.accPerformanceFeesToDAO.plus(feesToDAO);
	vault.accPerformanceFeesToStrategists = vault.accPerformanceFeesToStrategists.plus(feesToStrategist);
	// ongoingPerformanceFees and ongoingManagementFees are updated in the updateVault

	// save event
	newPerformanceFeesHarvest.save();

	// save vault
	vault.save();

	// -
	newSnapshot(factory, Address.fromString(vault.id), event.block, true);

	// -
	updateVault(vault);
}



// No entity are created here, only the vault is modified
export function handleAddAsset(event: AddAssetEvent): void {
	// load
	const factory = Factory.load(FACTORY_ADDRESS);

	// prevent error
	if (factory === null) return;

	// load
	const vault = Vault.load(event.address.toHexString());

	// prevent error
	if (vault == null) return;

	// load
	const storage = VaultContract.bind(Address.fromString(event.address.toHexString()));

	// source vault data
	const tokensLength = storage.tokensLength().toI32(); // At this point, the new token is added so length is true
	const newTokens = new Array<Bytes>(tokensLength); // https://medium.com/protofire-blog/subgraph-development-part-2-handling-arrays-and-identifying-entities-30d63d4b1dc6
	for (let tIndex = 0; tIndex < tokensLength; tIndex++) {
		const token = storage.tokens(BigInt.fromI32(tIndex));
		newTokens[tIndex] = token.value0; // Token Address
	}
	vault.tokens = newTokens;

	// save vault
	vault.save();

	// ?
	// newSnapshot(factory, Address.fromString(vault.id), event.block, true);

	// -
	updateVault(vault);
}

// Event Handlers that don't need to require to update the full state of the vault
export function handleSetShareTransferability(event: SetShareTransferability): void {
	// load
	const vault = Vault.load(event.address.toHexString());

	// prevent error
	if (vault == null) return;

	// source event data
	vault.shareTransferability = event.params.status;

	// save
	vault.save();

	// ?
	// newSnapshot(factory, Address.fromString(entity.id), event.block, true);

	// -
	updateVault(vault);
}

export function handleSetSecurityProps(event: SetSecurityProps): void {
	// load
	const vault = Vault.load(event.address.toHexString());

	// prevent error
	if (vault == null) return;

	// -
	const bdVault = VaultContract.bind(event.address);

	// source event data
	const securityProps = bdVault.getSecurityProps();
	vault.maxAUM = securityProps.maxAUM;
	vault.maxLossSwap = securityProps.maxLossSwap;
	vault.minAmountDeposit = securityProps.minAmountDeposit;
	vault.maxAmountDeposit = securityProps.maxAmountDeposit;
	vault.minFrequencySwap = securityProps.minFrequencySwap;
	vault.minSecurityTime = securityProps.minSecurityTime;
	vault.minHarvestThreshold = securityProps.minHarvestThreshold;

	// save
	vault.save();

	// ?
	// newSnapshot(factory, Address.fromString(entity.id), event.block, true);

	// -
	updateVault(vault);
}

export function handleSetConfigProps(event: SetConfigProps): void {
	// load
	const vault = Vault.load(event.address.toHexString());

	// prevent error
	if (vault == null) return;

	// -
	const bdVault = VaultContract.bind(event.address);

	// source event data
	const configProps = bdVault.getConfigProps();
	vault.paused = configProps.paused;
	vault.verified = configProps.verified;
	vault.name = configProps.name;
	vault.description = configProps.description;

	// save
	vault.save();

	// ?
	// buildVaultSnapshot(factory, Address.fromString(entity.id), event.block, true);

	// -
	updateVault(vault);
}

export function handleSetFeesProps(event: SetFeesProps): void {
	// load
	const vault = Vault.load(event.address.toHexString());

	// prevent error
	if (vault == null) return;

	// -
	const bdVault = VaultContract.bind(event.address);

	// source event data
	const feesProps = bdVault.getFeesProps();

	// source vault data
	vault.beneficiary = feesProps.beneficiary; // Strange
	vault.exitFees = feesProps.exitFees;
	vault.managementFeesRate = feesProps.managementFeesRate;
	vault.managementFeesToStrategist = feesProps.managementFeesToStrategist;
	vault.performanceFeesRate = feesProps.performanceFeesRate;
	vault.performanceFeesToStrategist = feesProps.performanceFeesToStrategist;

	// save
	vault.save();

	// ?
	// buildVaultSnapshot(factory, Address.fromString(entity.id), event.block, true);

	// -
	updateVault(vault);
}

export function handleRoleAdminChanged(event: RoleAdminChanged): void {
	const vault = Vault.load(event.address.toHexString());
	if (vault == null) return;
	log.debug("handleRoleAdminChanged", [])
	updateVault(vault);
}

export function handleRoleGranted(event: RoleGranted): void {
	const vault = Vault.load(event.address.toHexString());
	if (vault == null) return;
	log.debug("handleRoleGranted", [])
	updateVault(vault);
}

export function handleRoleRevoked(event: RoleRevoked): void {
	const vault = Vault.load(event.address.toHexString());
	if (vault == null) return;
	log.debug("handleRoleRevoked", [])
	updateVault(vault);
}

