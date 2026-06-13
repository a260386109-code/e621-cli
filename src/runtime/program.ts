import { Command } from "commander";
import { Envelope, ErrorEnvelope } from "./output.js";

export function emitResult(program: Command, envelope: Envelope | ErrorEnvelope, raw = false): void {
  (program as unknown as { emit: (event: string, envelope: Envelope | ErrorEnvelope, raw?: boolean) => void }).emit(
    "e621:result",
    envelope,
    raw
  );
}
