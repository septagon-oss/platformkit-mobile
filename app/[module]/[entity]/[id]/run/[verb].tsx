import React from "react";
import { ResourceRoute } from "../../../../../src/route";

export default function Run() {
  return <ResourceRoute kind="command" withID withVerb />;
}
