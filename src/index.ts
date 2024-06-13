import {
  Canister,
  ic,
  Err,
  nat64,
  Ok,
  Opt,
  Principal,
  query,
  Record,
  Result,
  StableBTreeMap,
  text,
  update,
  Variant,
  None,
  nat16,
  nat32,
} from "azle";

const RecordRate = Record({
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
  RecordingDoesNotExist: Principal,
});
type RecordRateError = typeof RecordRateError.tsType;

export default Canister({
  createRecord: update(
    [nat32, nat32, nat16, text],
    RecordRate,
    (movieId, userId, rate, comment) => {
      const id = generateId();
      const record: RecordRate = {
        id,
        movieId: movieId,
        userId: userId,
        createdAt: ic.time(),
        rate: rate,
        comment: comment,
      };

      recordsRate.insert(record.id, record);

      return record;
    }
  ),

  editRecord: update(
    [text, nat32, nat32, nat16, text],
    Result(RecordRate, RecordRateError),
    (id, movieId, userId, rate, comment) => {
      const principalId = Principal.fromText(id);
      const recordingOpt = recordsRate.get(principalId);
      if ("None" in recordingOpt) return Err({ RecordingDoesNotExist: principalId });

      const record = {
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

  readRecord: query([text], Opt(RecordRate), (id) => {
    const principalId = Principal.fromText(id);
    const recordingOpt = recordsRate.get(principalId);
    if ("None" in recordingOpt) return None;

    return recordingOpt;
  }),

  deleteRecord: update([text], Opt(RecordRate), (id) => {
    const principalId = Principal.fromText(id);
    const recordingOpt = recordsRate.get(principalId);
    if ("None" in recordingOpt) return None;
    return recordsRate.remove(principalId);
  }),
});

function generateId(): Principal {
  const randomBytes = new Array(29).fill(0).map((_) => Math.floor(Math.random() * 256));
  return Principal.fromUint8Array(Uint8Array.from(randomBytes));
}
