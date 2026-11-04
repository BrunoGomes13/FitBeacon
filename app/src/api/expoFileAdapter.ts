export type ExpoFileSystemContract<TFile> = {
  documentUri: string | null | undefined;
  createFile: (name: string) => TFile;
  exists: (file: TFile) => boolean;
  readText: (file: TFile) => Promise<string>;
  create: (file: TFile, options: { intermediates: boolean; overwrite: boolean }) => void;
  write: (file: TFile, value: string) => Promise<void>;
  delete: (file: TFile) => void;
  move: (
    file: TFile,
    destination: TFile,
    options: { overwrite: boolean },
  ) => Promise<void>;
};

export type AtomicJsonFileAdapter = {
  read: () => Promise<string | null>;
  writeTemporary: (value: string) => Promise<void>;
  replaceWithTemporary: () => Promise<void>;
  quarantine: () => Promise<void>;
};

export function createExpoFileAdapter<TFile>(
  fileSystem: ExpoFileSystemContract<TFile>,
): AtomicJsonFileAdapter {
  const files = () => {
    const documentUri = fileSystem.documentUri?.trim();
    if (!documentUri) {
      throw new Error('O diretório de documentos do Expo FileSystem está indisponível.');
    }
    return {
      primary: fileSystem.createFile('fitbeacon-sessions-v1.json'),
      temporary: fileSystem.createFile('fitbeacon-sessions-v1.tmp'),
    };
  };

  return {
    async read() {
      const { primary } = files();
      return fileSystem.exists(primary) ? fileSystem.readText(primary) : null;
    },
    async writeTemporary(value) {
      const { temporary } = files();
      if (fileSystem.exists(temporary)) fileSystem.delete(temporary);
      fileSystem.create(temporary, { intermediates: true, overwrite: true });
      await fileSystem.write(temporary, value);
    },
    async replaceWithTemporary() {
      const { primary, temporary } = files();
      await fileSystem.move(temporary, primary, { overwrite: true });
    },
    async quarantine() {
      const { primary } = files();
      if (!fileSystem.exists(primary)) return;
      const badFile = fileSystem.createFile(
        `fitbeacon-sessions-v1.${Date.now()}.${Math.random().toString(16).slice(2)}.bad`,
      );
      await fileSystem.move(primary, badFile, { overwrite: false });
    },
  };
}
