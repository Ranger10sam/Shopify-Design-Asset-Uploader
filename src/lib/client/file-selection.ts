"use client";

import { getParentDirectories, normalizeRelativePath } from "@/lib/upload-manifest";

export interface SelectedUploadFile {
  id: string;
  file: File;
  relativePath: string;
  size: number;
}

export interface SelectedFolder {
  files: SelectedUploadFile[];
  directories: string[];
  source: "filesystem-api" | "drag-drop" | "file-input";
  note?: string;
}

function createFileRecord(file: File, relativePath: string): SelectedUploadFile {
  return {
    id: crypto.randomUUID(),
    file,
    relativePath: normalizeRelativePath(relativePath),
    size: file.size,
  };
}

function buildSelectedFolder(options: {
  files: SelectedUploadFile[];
  directories: Iterable<string>;
  source: SelectedFolder["source"];
  note?: string;
}): SelectedFolder {
  const directorySet = new Set<string>();

  for (const file of options.files) {
    for (const parentDirectory of getParentDirectories(file.relativePath)) {
      directorySet.add(parentDirectory);
    }
  }

  for (const directory of options.directories) {
    directorySet.add(normalizeRelativePath(directory));
  }

  return {
    files: options.files.sort((left, right) => left.relativePath.localeCompare(right.relativePath)),
    directories: Array.from(directorySet).sort((left, right) => left.localeCompare(right)),
    source: options.source,
    note: options.note,
  };
}

async function walkDirectoryHandle(
  handle: FileSystemDirectoryHandle,
  currentPath: string,
  files: SelectedUploadFile[],
  directories: Set<string>,
): Promise<void> {
  directories.add(normalizeRelativePath(currentPath));

  for await (const entry of handle.values()) {
    const entryPath = normalizeRelativePath(`${currentPath}/${entry.name}`);

    if (entry.kind === "directory") {
      await walkDirectoryHandle(entry, entryPath, files, directories);
      continue;
    }

    const file = await entry.getFile();
    files.push(createFileRecord(file, entryPath));
  }
}

export async function collectFromDirectoryHandle(
  handle: FileSystemDirectoryHandle,
): Promise<SelectedFolder> {
  const files: SelectedUploadFile[] = [];
  const directories = new Set<string>();

  await walkDirectoryHandle(handle, handle.name, files, directories);

  return buildSelectedFolder({
    files,
    directories,
    source: "filesystem-api",
  });
}

function readFileEntry(entry: FileSystemFileEntry): Promise<File> {
  return new Promise((resolve, reject) => {
    entry.file(resolve, reject);
  });
}

function readAllDirectoryEntries(entry: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
  const reader = entry.createReader();
  const entries: FileSystemEntry[] = [];

  return new Promise((resolve, reject) => {
    const readNextChunk = (): void => {
      reader.readEntries(
        (chunk) => {
          if (chunk.length === 0) {
            resolve(entries);
            return;
          }

          entries.push(...chunk);
          readNextChunk();
        },
        (error) => reject(error),
      );
    };

    readNextChunk();
  });
}

async function walkDroppedEntry(
  entry: FileSystemEntry,
  currentPath: string,
  files: SelectedUploadFile[],
  directories: Set<string>,
): Promise<void> {
  const entryPath = normalizeRelativePath(currentPath);

  if (entry.isFile) {
    const file = await readFileEntry(entry as FileSystemFileEntry);
    files.push(createFileRecord(file, entryPath));
    return;
  }

  directories.add(entryPath);
  const childEntries = await readAllDirectoryEntries(entry as FileSystemDirectoryEntry);

  for (const childEntry of childEntries) {
    await walkDroppedEntry(childEntry, `${entryPath}/${childEntry.name}`, files, directories);
  }
}

export async function collectFromDropItems(items: DataTransferItemList): Promise<SelectedFolder> {
  const files: SelectedUploadFile[] = [];
  const directories = new Set<string>();
  const droppedEntries = Array.from(items)
    .map((item) => item.webkitGetAsEntry?.() ?? null)
    .filter((entry): entry is FileSystemEntry => entry !== null);

  for (const entry of droppedEntries) {
    await walkDroppedEntry(entry, entry.name, files, directories);
  }

  return buildSelectedFolder({
    files,
    directories,
    source: "drag-drop",
  });
}

export function collectFromInputFiles(fileList: FileList): SelectedFolder {
  const files = Array.from(fileList).map((file) =>
    createFileRecord(file, file.webkitRelativePath || file.name),
  );

  return buildSelectedFolder({
    files,
    directories: [],
    source: "file-input",
    note:
      "Your browser is using the folder-input fallback. Empty directories may not be visible unless you use desktop Chrome or Edge.",
  });
}
