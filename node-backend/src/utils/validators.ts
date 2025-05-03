import { ZodError } from "zod";
import { Message, MessageSchema } from "../models/types";

/**
 * Validates incoming message from the client
 *
 * @param data Raw message data as string
 * @returns Parsed and validated message, or throws error
 */
export function validateMessage(data: string): Message {
  try {
    const parsedData = JSON.parse(data);
    return MessageSchema.parse(parsedData);
  } catch (error) {
    if (error instanceof ZodError) {
      throw new Error(`Invalid message format: ${error.message}`);
    } else if (error instanceof SyntaxError) {
      throw new Error("Invalid JSON format");
    } else {
      throw error;
    }
  }
}
