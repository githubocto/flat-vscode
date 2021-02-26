import * as vscode from "vscode";
import { URL } from "url";
import { ConnectionString } from "connection-string";
import { createConnection } from "typeorm";

interface ActionParams {
  type?: string;
  name?: string;
  cron?: string;
  source?: string;
}

export function makeActionYaml(params: ActionParams) {
  const { name, cron, type, source } = params;
  return `name: ${name}

on:
  push:
    branches:
      - main
  workflow_dispatch:
  schedule:
    - cron: '${cron}'
  
jobs:
  scheduled:
    runs-on: ubuntu-latest
    steps:
    - name: Check out repo
      uses: actions/checkout@v2
    - name: Fetch data
      uses: githubocto/flat-action@v1
      with:
        ${type === "html" ? `url: '${source}'` : ""}
        ${
          type === "sql"
            ? `
        # We'll upload an encrypted version of your connection string as a secret
        connstring: \${{ secrets.CONNSTRING }}
        `
            : "\n"
        }
        ${
          type === "sql"
            ? `
      # After hitting "Save and Commit Action", you'll be prompted to write your SQL query.
        queryfile: query.sql`
            : "\n"
        }
    - name: Commit and push if changed
      run: |-
        git config user.name "Flat"
        git config user.email "actions@users.noreply.github.com"
        git add -A
        timestamp=$(date -u)
        git commit -m "Latest data: \${timestamp}" || exit 0
        git push
`.replace(/^\s*[\r\n]/gm, "");
}

export function escapeRegExp(str: string) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function makeRangeFromMatch(line: number, match: RegExpMatchArray) {
  return new vscode.Range(
    // @ts-ignore
    new vscode.Position(line, match.index),
    // @ts-ignore
    new vscode.Position(line, match.index + match[0].length)
  );
}

export function isValidUrl(input: string) {
  let url;

  try {
    url = new URL(input);
  } catch (_) {
    return false;
  }

  return url.protocol === "http:" || url.protocol === "https:";
}

interface GetSessionParams {
  createIfNone: boolean;
}

const GITHUB_AUTH_PROVIDER_ID = "github";
const SCOPES = ["user:email", "repo"];

export function getSession(params: GetSessionParams) {
  const { createIfNone } = params;
  return vscode.authentication.getSession(GITHUB_AUTH_PROVIDER_ID, SCOPES, {
    createIfNone,
  });
}

export function getNonce() {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export async function testConnection(connectionString: string) {
  try {
    const parsed = new ConnectionString(connectionString);
    const protocol = parsed.protocol;

    if (!protocol) {
      throw new Error("Unable to connect to database.");
    }

    // @ts-ignore
    const connection = await createConnection({
      type: protocol,
      url: connectionString,
      ssl: true,
      extra: {
        ssl: {
          rejectUnauthorized: false,
        },
      },
    });

    await connection.close();
  } catch (e) {
    throw e;
  }
}
