import { describe, expect, it } from "vitest";
import { folderFromPath, mapDriveItem } from "./files";

/** The pure half of the OneDrive search. (ANA-07) */

describe("folderFromPath", () => {
  it("turns Graph's drive path into the folder a person would say", () => {
    expect(folderFromPath("/drive/root:/Documents/Fleury")).toBe("Documents/Fleury");
  });

  it("is empty at the root", () => {
    expect(folderFromPath("/drive/root:")).toBe("");
    expect(folderFromPath(undefined)).toBe("");
  });

  it("decodes what Graph encoded", () => {
    expect(folderFromPath("/drive/root:/Dossiers%20clients/D%C3%A9g%C3%A2t")).toBe(
      "Dossiers clients/Dégât",
    );
  });
});

describe("mapDriveItem", () => {
  it("maps a document with its place, date and editor", () => {
    const file = mapDriveItem({
      name: "plan-fleury.pdf",
      size: 2_400_000,
      webUrl: "https://onedrive.example/x",
      lastModifiedDateTime: "2026-08-26T10:00:00Z",
      lastModifiedBy: { user: { displayName: "Marie Tremblay" } },
      parentReference: { path: "/drive/root:/Documents/Fleury" },
    });
    expect(file).toEqual({
      name: "plan-fleury.pdf",
      folder: "Documents/Fleury",
      modifiedAt: "2026-08-26T10:00:00Z",
      modifiedBy: "Marie Tremblay",
      size: 2_400_000,
      webUrl: "https://onedrive.example/x",
    });
  });

  it("drops folders — the owner asks for documents, not directories", () => {
    expect(mapDriveItem({ name: "Fleury", folder: { childCount: 12 } })).toBeNull();
  });

  it("drops the nameless", () => {
    expect(mapDriveItem({})).toBeNull();
  });
});
