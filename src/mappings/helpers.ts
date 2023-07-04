import { BigInt } from "@graphprotocol/graph-ts";

export let ZERO_BI = BigInt.fromI32(0);
export let ONE_BI = BigInt.fromI32(1);
export let BI_18 = BigInt.fromI32(18);

export const ADDRESS_ZERO = "0x0000000000000000000000000000000000000000";
export const FACTORY_ADDRESS = "0xF14c4B935054b8D1017Ad96c9a265EB7F8ECF13c";
export const SNAPSHOT_TIMEFRAME = BigInt.fromI32(60 * 60); // 1H