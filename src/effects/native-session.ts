import * as SecureStore from "expo-secure-store";
import { createSessionStore } from "./session";

export const sessions = createSessionStore(SecureStore);
