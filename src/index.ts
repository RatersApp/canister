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
  Vec,
  nat32,
  int16,
} from "azle";

let count: nat64 = 0n;

const RecordRate = Record({
  id: Principal,
  movieId: nat64,
  userId: nat64,
  createdAt: nat64,
  rate: int16,
  comment: text,
});
type RecordRate = typeof RecordRate.tsType;
let recordsRate = StableBTreeMap<Principal, RecordRate>(0);

const RecordRateError = Variant({
  RecordingDoesNotExist: Principal,
  UserDoesNotExist: Principal,
});
type RecordRateError = typeof RecordRateError.tsType;

export default Canister({
  createRecord: update(
    [nat64, nat64, int16, text],
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
    [Principal, nat64, nat64, int16, text],
    RecordRate,
    (id, movieId, userId, rate, comment) => {
      const recordingOpt = recordsRate.get(id);
      // if ("None" in recordingOpt) {
      //   return Err({ RecordingDoesNotExist: id });
      // }
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

  readRecord: query([Principal], Opt(RecordRate), (id) => {
    return recordsRate.get(id);
  }),

  deleteRecord: update([Principal], Result(RecordRate, RecordRateError), (id) => {
    const recordingOpt = recordsRate.get(id);

    if ("None" in recordingOpt) {
      return Err({ RecordingDoesNotExist: id });
    }

    const recording = recordingOpt.Some;

    recordsRate.remove(id);

    return Ok(recording);
  }),
});

function generateId(): Principal {
  const randomBytes = new Array(29).fill(0).map((_) => Math.floor(Math.random() * 256));
  return Principal.fromUint8Array(Uint8Array.from(randomBytes));
}
