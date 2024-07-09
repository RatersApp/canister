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

const WhoAmI = Record({
  whoami: text,
  authorized: bool,
});
type WhoAmI = typeof WhoAmI.tsType;

const RecordRate = Record({
  author: Principal,
  id: Principal,
  movieId: nat32,
  userId: nat32,
  userPrincipal: Principal,
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
  whoami: query([], WhoAmI, () => {
    const whoami = getMyPrincipal();
    if (!whoami) return { whoami: "anonymous", authorized: false };
    return { whoami: whoami.toText(), authorized: checkPermission(whoami) };
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
    [nat32, nat32, text, nat16, text],
    Result(RecordRate, RecordRateError),
    (movieId, userId, userTextPrincipal, rate, comment) => {
      const whoami = getMyPrincipal();
      if (!whoami) return Err({ Message: "RecordAccessDenied" });

      let userPrincipal;
      try {
        userPrincipal = Principal.fromText(userTextPrincipal);
      } catch (e) {
        return Err({ Message: "PrincipalIncorrect" });
      }
  
      const id = generateId();
      const record: RecordRate = {
        author: whoami,
        id,
        movieId: movieId,
        userId: userId,
        userPrincipal: userPrincipal,
        createdAt: ic.time(),
        rate: rate,
        comment: comment,
      };

      recordsRate.insert(record.id, record);

      return Ok(record);
    }
  ),

  editRecord: update(
    [text, nat16, text],
    Result(RecordRate, RecordRateError),
    (id, rate, comment) => {
      const whoami = getMyPrincipal();
      if (!whoami) return Err({ Message: "RecordAccessDenied" });

      let principalId;
      try {
        principalId = Principal.fromText(id);
      } catch (e) {
        return Err({ Message: "RecordDoesNotExist" });
      }
      const recordOpt = recordsRate.get(principalId);
      if ("None" in recordOpt) return Err({ Message: "RecordDoesNotExist" });
      if (!checkPermission(whoami, recordOpt.Some.author, recordOpt.Some.userPrincipal))
        return Err({ Message: "RecordAccessDenied" });

      const record: RecordRate = {
        author: recordOpt.Some.author,
        id: recordOpt.Some.id,
        movieId: recordOpt.Some.movieId,
        userId: recordOpt.Some.userId,
        userPrincipal: recordOpt.Some.userPrincipal,
        createdAt: recordOpt.Some.createdAt,
        rate: rate,
        comment: comment,
      };

      recordsRate.insert(record.id, record);

      return Ok(record);
    }
  ),

  readRecord: query([text], Result(RecordRate, RecordRateError), (id) => {
    let principalId;
    try {
      principalId = Principal.fromText(id);
    } catch (e) {
      return Err({ Message: "RecordDoesNotExist" });
    }

    const recordOpt = recordsRate.get(principalId);
    if ("None" in recordOpt) return Err({ Message: "RecordDoesNotExist" });

    return Ok(recordOpt.Some);
  }),

  deleteRecord: update([text], Result(RecordRate, RecordRateError), (id) => {
    const whoami = getMyPrincipal();
    if (!whoami) return Err({ Message: "RecordAccessDenied" });

    let principalId;
    try {
      principalId = Principal.fromText(id);
    } catch (e) {
      return Err({ Message: "RecordDoesNotExist" });
    }

    const recordOpt = recordsRate.get(principalId);
    if ("None" in recordOpt) return Err({ Message: "RecordDoesNotExist" });
    if (!checkPermission(whoami, recordOpt.Some.author, recordOpt.Some.userPrincipal))
      return Err({ Message: "RecordAccessDenied" });

    recordsRate.remove(principalId);
    return Ok(recordOpt.Some);
  }),
});

function generateId(): Principal {
  const randomBytes = new Array(29).fill(0).map((_) => Math.floor(Math.random() * 256));
  return Principal.fromUint8Array(Uint8Array.from(randomBytes));
}

function checkPermission(
  whoami: Principal,
  principal?: Principal,
  userPrincipal?: Principal
): bool {
  if (
    (principal && whoami.compareTo(principal) === "eq") ||
    (userPrincipal && whoami.compareTo(userPrincipal) === "eq")
  )
    return true;
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
