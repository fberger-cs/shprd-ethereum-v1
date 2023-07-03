import { ethereum, Bytes, log } from "@graphprotocol/graph-ts";
import { BigInt, Address } from "@graphprotocol/graph-ts";
import {
  VaultCreated, SetAccessManager,
  SetFeesManager,
  SetHarvester,
  SetSwapContracts,
  AddTokensAndPriceFeeds,
  RemoveTokensAndPriceFeeds,
  SetSwapAdapter,
  OwnershipTransferred,
} from "../types/Factory";
import { Vault, Factory } from '../types/schema';
import { Vault as VaultContract } from "../types/Factory/Vault";
import { Factory as FactoryContract } from "../types/Factory/Factory";
import { Vault as VaultTemplate } from "../types/templates";
import { FACTORY_ADDRESS, ZERO_BI, SNAPSHOT_TIMEFRAME } from './helpers';
import { VaultSnapshot } from "../types/schema";
import { store } from '@graphprotocol/graph-ts'


/**
 * This function should be called only once when the first vault is created and subgraph isn't yet deployed
 * @param event The vault creation event
 * @returns The create factory entity
 */

export function _createFactory(event: VaultCreated): Factory {
  log.debug("CALL : _createFactory", []);

  // load
  const factory = new Factory(FACTORY_ADDRESS);

  // prevent error
	if (factory === null) return;

  // set
  factory.vaultCount = 0;

  // ? bind
  const bindedFactory = FactoryContract.bind(Address.fromString(FACTORY_ADDRESS));

  // source binded factory data
  const tokens = bindedFactory.getWhitelistedTokens();
  const tokensArray = new Array<Bytes>(tokens.length);
  for (let x = 0; x < tokens.length; x++) tokensArray[x] = tokens[x];
  factory.tokens = tokensArray;

  // source factory data
  factory.feesManager = bindedFactory.feesManager();
  factory.accessManager = bindedFactory.accessManager();
  factory.harvester = bindedFactory.harvester();
  factory.swapRouter = bindedFactory.swapRouter();
  factory.swapProxy = bindedFactory.swapProxy();
  factory.swapAdapter = bindedFactory.swapAdapter();
  factory.lastSnapshotBlockTimestamp = event.block.timestamp;
  factory.lastSnapshotBlockNumber = event.block.number;

  // save
  factory.save();

  // -
  return factory;
}

/**
 * Update the full content of a vault
 * @param vAddress His address
 * @param vault The instance itself
 * @returns /
 */

export const updateVault = (vault: Vault): Vault => {
  log.debug("CALL : updateVault", []);

  // ? bind
  const bindedFactory = FactoryContract.bind(Address.fromString(FACTORY_ADDRESS));
  const bindedVault = VaultContract.bind(Address.fromString(vault.id));

  // source binded factory data
  const vaultState = bindedFactory.getVaultState(Address.fromString(vault.id));
  const shareState = bindedFactory.getShareState(Address.fromString(vault.id));

  // source binded vault data > tokens
  const tokensLength = bindedVault.tokensLength().toI32();
  const tokens = new Array<Bytes>(tokensLength);
  const tokensPriceFeedAddress = new Array<Bytes>(tokensLength); // String != string
  const tokensPriceFeedPrecision = new Array<BigInt>(tokensLength);
  const tokensDenominator = new Array<BigInt>(tokensLength);
  for (let tIndex = 0; tIndex < tokensLength; tIndex++) {
    const tokenData = bindedVault.tokens(BigInt.fromI32(tIndex));
    tokens[tIndex] = tokenData.value0
    tokensPriceFeedAddress[tIndex] = tokenData.value1;
    tokensPriceFeedPrecision[tIndex] = BigInt.fromI32(tokenData.value2);
    tokensDenominator[tIndex] = tokenData.value3;
  };
  vault.tokens = tokens;
  vault.tokensPriceFeedAddress = tokensPriceFeedAddress
  vault.tokensPriceFeedPrecision = tokensPriceFeedPrecision;
  vault.tokensDenominator = tokensDenominator;

  // legacy debug
  // log.debug("CALL:  bindedFactory._address: {}", [bindedFactory._address.toHexString()]);
  // log.debug("CALL:  bindedFactory._name: {}", [bindedFactory._name]);
  // log.debug("CALL:  bindedFactory.harvester: {}", [bindedFactory.harvester().toHexString()]);

  // source binded vault data > roles
  const vaultRoles = bindedFactory.getRolesPerVault(Address.fromString(vault.id));
  const admins = new Array<Bytes>(vaultRoles.value1.length);
  const strategists = new Array<Bytes>(vaultRoles.value2.length);
  const harvesters = new Array<Bytes>(vaultRoles.value3.length);
  for (let rIndex = 0; rIndex < vaultRoles.value1.length; rIndex++) admins[rIndex] = vaultRoles.value1[rIndex];
  for (let rIndex = 0; rIndex < vaultRoles.value2.length; rIndex++) strategists[rIndex] = vaultRoles.value2[rIndex];
  for (let rIndex = 0; rIndex < vaultRoles.value3.length; rIndex++) harvesters[rIndex] = vaultRoles.value3[rIndex];
  vault.admins = admins;
  vault.strategists = strategists;
  vault.harvesters = harvesters;

  // source binded vault data > config
  const configProps = bindedVault.getConfigProps();
  vault.paused = configProps.paused;
  vault.verified = configProps.verified;
  vault.name = configProps.name;
  vault.description = configProps.description;

  // source binded vault data > constants
  const constantProps = bindedVault.getConstantProps();
  vault.factoryAddress = constantProps.factory;
  vault.createdAt = constantProps.createdAt;
  vault.share = constantProps.share;

  // source binded vault data > fees
  const feesProps = bindedVault.getFeesProps();
  vault.beneficiary = feesProps.beneficiary; // Strange
  vault.exitFees = feesProps.exitFees;
  vault.managementFeesRate = feesProps.managementFeesRate;
  vault.managementFeesToStrategist = feesProps.managementFeesToStrategist;
  vault.performanceFeesRate = feesProps.performanceFeesRate;
  vault.performanceFeesToStrategist = feesProps.performanceFeesToStrategist;

  // source binded vault data > history
  const historyProps = bindedVault.getHistoryProps();
  vault.highWaterMark = historyProps.highWaterMark;
  vault.prevRebalanceSignals = historyProps.prevRebalanceSignals;
  vault.prevSwap = historyProps.prevSwap;
  vault.prevMngHarvest = historyProps.prevMngHarvest;

  // source binded vault data > security
  const securityProps = bindedVault.getSecurityProps();
  vault.maxAUM = securityProps.maxAUM;
  vault.maxLossSwap = securityProps.maxLossSwap;
  vault.minAmountDeposit = securityProps.minAmountDeposit;
  vault.maxAmountDeposit = securityProps.maxAmountDeposit;
  vault.minFrequencySwap = securityProps.minFrequencySwap;
  vault.minSecurityTime = securityProps.minSecurityTime;
  vault.minHarvestThreshold = securityProps.minHarvestThreshold;

  // source binded vault data > fees compute
  const sharePrice = vaultState.value9;
  const pendingPerfFees = bindedVault.getPerformanceFees().value0;
  const pendingManagementFees = bindedVault.getManagementFees().value0;
  const shareSupply = shareState.value4;
  vault.balances = vaultState.value6;
  vault.positions = vaultState.value7;
  vault.tvl = vaultState.value8;
  vault.sharePrice = sharePrice;
  vault.ongoingManagementFees = pendingManagementFees;
  vault.ongoingPerformanceFees = pendingPerfFees;
  vault.netSharePrice = (shareSupply == BigInt.fromI32(0)) ?  BigInt.fromI32(1) : sharePrice.times(shareSupply).div(shareSupply.plus(pendingManagementFees).plus(pendingPerfFees));
  vault.sharePriceNetFromMngFees = (shareSupply == BigInt.fromI32(0)) ? BigInt.fromI32(1) : sharePrice.times(shareSupply).div(shareSupply.plus(pendingManagementFees));
  vault.sharePriceNetFromPerfFees = (shareSupply == BigInt.fromI32(0)) ? BigInt.fromI32(1) : sharePrice.times(shareSupply).div(shareSupply.plus(pendingPerfFees));

  // save
  vault.save();

  // -
  return vault;
}

/**
 * Internal handler to create the vault
 * @param event Event of creation
 * @param factory Factory instance
 */

export function _createVault(event: VaultCreated, factory: Factory): Vault {
  // ?
  let vault = new Vault(event.params.vault.toHexString()) as Vault;

  // source vault data
  vault.factory = factory.id;
  vault.vault = event.params.vault;
  vault.creator = event.transaction.from;
  vault.shareTransferability = false;
  vault.accManagementFeesToDAO = ZERO_BI;
  vault.accPerformanceFeesToDAO = ZERO_BI;
  vault.accManagementFeesToStrategists = ZERO_BI;
  vault.accPerformanceFeesToStrategists = ZERO_BI;
  vault.depositsCount = 0;
  vault.rebalancesCount = 0;
  vault.redemptionsCount = 0;
  vault.netSharePrice = BigInt.fromI32(1);
  vault.sharePriceNetFromMngFees = BigInt.fromI32(1);
  vault.sharePriceNetFromPerfFees = BigInt.fromI32(1);

  // -
  const updatedVault = updateVault(vault);

  // -
  updatedVault.save();

  // ?
  return vault;
}

/**
 * Create a vault, via the factory event
 * @param event /
 */

export function handleCreateVault(event: VaultCreated): void {
  log.debug("CALL : handleCreateVault", []);

  // load
  let factory = Factory.load(FACTORY_ADDRESS);

  // prevent error
  if (factory === null) factory = _createFactory(event);

  // -
  factory.vaultCount = factory.vaultCount + 1;

  // save
  factory.save();

  // -
  const vault = _createVault(event, factory);

  // -
  VaultTemplate.create(event.params.vault);

  // -
  vault.save();

  // -
  factory.save();
}

/**
 * Take a snapshot for each vault
 * @param factory Factory instance
 * @param vaultAddress Vault address
 * @param block Block of the event
 * @param triggeredByEvent Wethever the snapshot is triggered by an event or the `handbleBlock` handler. To be used in the frontend possibly
 */

export function newSnapshot(
  factory: Factory,
  vaultAddress: Address,
  block: ethereum.Block,
  triggeredByEvent: boolean,
): void {
  // load
  const vault = VaultContract.bind(vaultAddress);

  // prevent error
	if (factory === null) return;

  // load binded factory
  const bindedFactory = FactoryContract.bind(Address.fromString(factory.id));

  // ? build name
  const entityName = FACTORY_ADDRESS + "-" + vaultAddress.toHexString() + "-" + block.number.toString();

  // source vault data
  const status = vault.getVaultStatus();
  const tokensLength = vault.tokensLength().toI32();
  const assetsPrices = new Array<BigInt>(tokensLength);
  const newTokens = new Array<Bytes>(tokensLength);
  const shareState = bindedFactory.getShareState(vaultAddress);
  const sharePrice = status.value2;
  const pendingPerfFees = vault.getPerformanceFees().value0;
  const pendingManagementFees = vault.getManagementFees().value0;
  const shareSupply = shareState.value4;
  for (let tIndex = 0; tIndex < tokensLength; tIndex++) {
    const asset = vault.tokens(BigInt.fromI32(tIndex));
    const price = vault.getLatestPrice(asset.value1);
    assetsPrices[tIndex] = price;
    newTokens[tIndex] = asset.value0;
  }
  const assetsBalances = vault.getVaultBalances();

  // load
  const snapshot = new VaultSnapshot(entityName);

  // source snapshot data
  snapshot.factory = factory.id;
  snapshot.vault = vaultAddress.toHexString();
  snapshot.assetsBalances = assetsBalances;
  snapshot.assetsPrices = assetsPrices;
  snapshot.tokens = newTokens;
  snapshot.positions = status.value0;
  snapshot.tvl = status.value1;
  snapshot.sharePrice = sharePrice;
  snapshot.netSharePrice = (shareSupply == BigInt.fromI32(0)) ? BigInt.fromI32(1) : sharePrice.times(shareSupply).div(shareSupply.plus(pendingManagementFees).plus(pendingPerfFees));
  snapshot.sharePriceNetFromMngFees = (shareSupply == BigInt.fromI32(0)) ? BigInt.fromI32(1) : sharePrice.times(shareSupply).div(shareSupply.plus(pendingManagementFees));
  snapshot.sharePriceNetFromPerfFees = (shareSupply == BigInt.fromI32(0)) ? BigInt.fromI32(1) : sharePrice.times(shareSupply).div(shareSupply.plus(pendingPerfFees));
  snapshot.pendingPerfFees = pendingPerfFees;
  snapshot.pendingMngFees = pendingManagementFees;
  snapshot.timestamp = block.timestamp;
  snapshot.triggeredByEvent = triggeredByEvent;

  // -
  snapshot.save();
}

/**
 * Handle the modification of the access manager contract - Might not be used because we can upgrade the access manager itself
 * @param event /
 * @returns /
 */

export function handleSetAccessManager(event: SetAccessManager): void {
  // load
  let factory = Factory.load(FACTORY_ADDRESS);

  // prevent errors
  if (factory === null) return;

  // source event data
  factory.accessManager = event.params.newAccessManager;

  // -
  factory.save();
}

/**
 * Handle the modification of the fees manager contract - Might not be used because we can upgrade the fees manager itself
 * @param event /
 * @returns /
 */

export function handleSetFeesManager(event: SetFeesManager): void {
  // load
  let factory = Factory.load(FACTORY_ADDRESS);

  // prevent errors
  if (factory === null) return;

  // source event data
  factory.feesManager = event.params.newFeesManager;

  // -
  factory.save();
}

/**
 * Handle the modification of the default fees harvester address
 * @param event /
 * @returns /
 */

export function handleSetHarvester(event: SetHarvester): void {
  // load
  let factory = Factory.load(FACTORY_ADDRESS);

  // prevent errors
  if (factory === null) return;

  // source event data
  factory.harvester = event.params.newHarvester;

  // -
  factory.save();

}

/**
 * Handle the modification of swap contracts, used by vaults
 * @param event /
 * @returns /
 */

export function handleSetSwapContracts(event: SetSwapContracts): void {
  // load
  let factory = Factory.load(FACTORY_ADDRESS);

  // prevent errors
  if (factory === null) return;

  // source event data
  factory.swapProxy = event.params.newSwapProxy;
  factory.swapRouter = event.params.newSwapRouter;

  // -
  factory.save();
}

/**
 * Update the factory tokens at removal of tokens
 * @param event /
 * @returns /
 */

export function handleAddTokensAndPriceFeeds(event: AddTokensAndPriceFeeds): void {
  // load
  let factory = Factory.load(FACTORY_ADDRESS);

  // prevent errors
  if (factory === null) return;

  // ? bind factory
  const factoryContract = FactoryContract.bind(Address.fromString(FACTORY_ADDRESS));

  // source factory data
  const currentTokens = factoryContract.getWhitelistedTokens();
  const tmp = new Array<Bytes>(currentTokens.length);
  for (let tIndex = 0; tIndex < currentTokens.length; tIndex++) tmp[tIndex] = currentTokens[tIndex];
  factory.tokens = tmp;

  // -
  factory.save();
}

/**
 * Update the factory tokens at removal of tokens
 * @param event /
 * @returns /
 */

export function handleRemoveTokensAndPriceFeeds(event: RemoveTokensAndPriceFeeds): void {
  // load
  let factory = Factory.load(FACTORY_ADDRESS);

  // prevent errors
  if (factory === null) return;

  // source factory data
  const factoryContract = FactoryContract.bind(Address.fromString(FACTORY_ADDRESS));
  const currentTokens = factoryContract.getWhitelistedTokens();
  const tmp = new Array<Bytes>(currentTokens.length);
  for (let tIndex = 0; tIndex < currentTokens.length; tIndex++) tmp[tIndex] = currentTokens[tIndex];
  factory.tokens = tmp;

  // -
  factory.save();
}

/**
 * @param event
 * @returns
 */

export function handleSetSwapAdapter(event: SetSwapAdapter): void {
  // load
  let factory = Factory.load(FACTORY_ADDRESS);

  // prevent further processing
  if (factory === null) return;

  // source event data
  factory.swapAdapter = event.params.newSwapAdapter;

  // save
  factory.save();
}

/**
 * New block handler
 * @notice It's normal that the graph will create tons of snapshots during the deploy/sync time, because it look over tons of past blocks
 * @param block Current Block
 * @returns /
 */

export function handleNewBlock(block: ethereum.Block): void {
  // load
  const factory = Factory.load(FACTORY_ADDRESS);

  // prevent further processing
  if (factory === null) {
    log.debug("handleNewBlock : No Factory yet", []);
    return;
  }

  // prevent further processing
  if (!snapshotOrNot(block) == false) return;

  // fn state
  const factoryStorage = FactoryContract.bind(Address.fromString(FACTORY_ADDRESS));

  // source factory data
  const factoryState = factoryStorage.getFactoryState();
  const vaults = factoryState.value0;
  for (let vIndex = 0; vIndex < vaults.length; vIndex++) {
    const vAddress = vaults[vIndex];

    // -
    newSnapshot(factory, vAddress, block, false);

    // load
    let vault = Vault.load(vAddress.toHexString());

    // prevent further processing
    if (vault === null) continue;

    // -
    updateVault(vault);
  }
  factory.lastSnapshotBlockTimestamp = block.timestamp;
  factory.lastSnapshotBlockNumber = block.number;

  // -
  factory.save();
}


/**
 * Tells if we should snapshot or not -- We snapshot only every 1 hour
 * @param block /
 * @returns /
 */

export function snapshotOrNot(block: ethereum.Block): boolean {
  // load
  const factory = Factory.load(FACTORY_ADDRESS);

  // prevent further processing
  if (factory === null) {
    log.debug("snapshotOrNot : No Factory yet", []);
    return false
  }

  // fn state
  const lastSnapTimestamp = factory.lastSnapshotBlockTimestamp;
  const currentTime = block.timestamp;
  const elaspedTime = currentTime.minus(lastSnapTimestamp)

  // compare
  const skipSnapshot = elaspedTime.le(SNAPSHOT_TIMEFRAME);

  // debug
  // log.debug("CALL : currentTime: {}", [currentTime.toString()]);
  // log.debug("CALL : lastSnapTimestamp: {}", [lastSnapTimestamp.toString()]);
  // log.debug("CALL : elaspedTime: {}", [elaspedTime.toString()]);
  // log.debug("CALL : SNAPSHOT_TIMEFRAME: {}", [SNAPSHOT_TIMEFRAME.toString()]);
  // log.debug("CALL : skipSnapshot: {}", [skipSnapshot.toString()]);

  // -
  return skipSnapshot;
}

export function handleOwnershipTransferred(event: OwnershipTransferred): void {
  // load
  const factory = Factory.load(FACTORY_ADDRESS);

  // prevent further processing
  if (factory === null) return;

  // -
  // Nothing to do. We don't store the owner
}