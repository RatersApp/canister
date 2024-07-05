import {
  Canister,
  ic,
  Err,
  nat64,
  Ok,
  Principal,
  query,
  Record,
  Result,
  StableBTreeMap,
  text,
  update,
  Variant,
  nat16,
  nat32,
  bool,
} from "azle";
import { managementCanister } from "azle/canisters/management";

const RecordRate = Record({
  author: Principal,
  id: Principal,
  movieId: nat32,
  userId: nat32,
  createdAt: nat64,
  rate: nat16,
  comment: text,
});
type RecordRate = typeof RecordRate.tsType;
let recordsRate = StableBTreeMap<Principal, RecordRate>(0);

const RecordRateError = Variant({
  Message: text,
});
type RecordRateError = typeof RecordRateError.tsType;

let controllers = StableBTreeMap<Principal>(0);

const ratersCanister = Canister({
  whoami: query([], text, () => {
    const whoami = getMyPrincipal();
    if (!whoami) return "anonymous authorized: false";
    return whoami.toText() + " authorized: " + checkPermission(generateId(), whoami);
  }),

  updateControllers: update([], bool, async () => {
    if (!getMyPrincipal()) return false;
    const canisterId = ic.id();
    const response = await ic.call(managementCanister.canister_status, {
      args: [
        {
          canister_id: canisterId,
        },
      ],
    });
    controllers.values().forEach((r) => {
      controllers.remove(r);
    });
    response.settings.controllers.forEach((r) => {
      controllers.insert(r, r);
    });

    return true;
  }),

  createRecord: update(
    [nat32, nat32, nat16, text],
    Result(RecordRate, RecordRateError),
    (movieId, userId, rate, comment) => {
      const whoami = getMyPrincipal();
      if (!whoami) return Err({ Message: "RecordingAccessDenied" });

      const id = generateId();
      const record: RecordRate = {
        author: whoami,
        id,
        movieId: movieId,
        userId: userId,
        createdAt: ic.time(),
        rate: rate,
        comment: comment,
      };

      recordsRate.insert(record.id, record);

      return Ok(record);
    }
  ),

  editRecord: update(
    [text, nat32, nat32, nat16, text],
    Result(RecordRate, RecordRateError),
    (id, movieId, userId, rate, comment) => {
      const whoami = getMyPrincipal();
      if (!whoami) return Err({ Message: "RecordingAccessDenied" });

      const principalId = Principal.fromText(id);
      const recordingOpt = recordsRate.get(principalId);
      if ("None" in recordingOpt) return Err({ Message: "RecordingDoesNotExist" });
      if (!checkPermission(recordingOpt.Some.author, whoami))
        return Err({ Message: "RecordingAccessDenied" });

      const record: RecordRate = {
        author: recordingOpt.Some.author,
        id: principalId,
        movieId: movieId,
        userId: userId,
        createdAt: ic.time(),
        rate: rate,
        comment: comment,
      };

      recordsRate.insert(record.id, record);

      return Ok(record);
    }
  ),

  readRecord: query([text], Result(RecordRate, RecordRateError), (id) => {
    const principalId = Principal.fromText(id);
    const recordingOpt = recordsRate.get(principalId);
    if ("None" in recordingOpt) return Err({ Message: "RecordingDoesNotExist" });

    return Ok(recordingOpt.Some);
  }),

  deleteRecord: update([text], Result(RecordRate, RecordRateError), (id) => {
    const whoami = getMyPrincipal();
    if (!whoami) return Err({ Message: "RecordingAccessDenied" });

    const principalId = Principal.fromText(id);
    const recordingOpt = recordsRate.get(principalId);
    if ("None" in recordingOpt) return Err({ Message: "RecordingDoesNotExist" });
    if (!checkPermission(recordingOpt.Some.author, whoami))
      return Err({ RecordingAccessDenied: principalId });

    recordsRate.remove(principalId);
    return Ok(recordingOpt.Some);
  }),
});

function generateId(): Principal {
  const randomBytes = new Array(29).fill(0).map((_) => Math.floor(Math.random() * 256));
  return Principal.fromUint8Array(Uint8Array.from(randomBytes));
}

function checkPermission(principal: Principal, whoami: Principal): bool {
  if (whoami.compareTo(principal) === "eq") return true;
  const controllerOpt = controllers.get(whoami);
  if ("None" in controllerOpt) return false;
  return true;
}

function getMyPrincipal(): Principal | null {
  const caller = ic.caller();
  if (caller.isAnonymous()) {
    return null;
  }
  return caller;
}

export default ratersCanister;
