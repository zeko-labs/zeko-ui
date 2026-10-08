{
  lib,
  stdenvNoCC,
  dockerTools,
  tzdata,
  nodejs,
  pnpm_10,
  fetchPnpmDeps,
  pnpmConfigHook,
  callPackage,
  source,
}:
let
  pnpm = pnpm_10;
  version = "0.1.0";

  # `source` is the whole checkout (a `path:.` flake reference copies tracked
  # and untracked files alike). Only the files pnpm and tsdown need are kept:
  # the filter drops every directory named below at any depth (node_modules,
  # build outputs, tool caches, worktrees, operator evidence) and every
  # `.env*` / `.dev.vars` file, on top of lib.cleanSourceFilter (VCS metadata,
  # editor backups). Every workspace package.json stays in, because pnpm
  # validates the frozen lockfile against the full workspace even for filtered
  # installs.
  excludedDirectoryNames = [
    "node_modules"
    "dist"
    ".moon"
    ".output"
    ".nuxt"
    ".nitro"
    ".data"
    ".cache"
    ".wrangler"
    ".playwright-mcp"
    ".planning"
    "coverage"
    "target"
    "ataski"
    "decommission-evidence"
  ];
  workspaceSource = lib.cleanSourceWith {
    name = "zeko-ui-source";
    src = source;
    filter =
      path: type:
      let
        name = baseNameOf path;
      in
      lib.cleanSourceFilter path type
      && !(type == "directory" && builtins.elem name excludedDirectoryNames)
      && !(type == "regular" && (lib.hasPrefix ".env" name || name == ".dev.vars"));
  };

  # pnpm filter selecting the indexer and its workspace dependencies:
  # @zeko/actions-indexer, @zeko/actions-api, @zeko-labs/bridge-sdk,
  # @zeko-labs/graphql. The API's dependency set is a subset, so one fetched
  # store serves both images.
  workspaceFilter = "@zeko/actions-indexer...";

  pnpmDeps = fetchPnpmDeps {
    pname = "zeko-actions-workspace";
    inherit version pnpm;
    src = workspaceSource;
    fetcherVersion = 2;
    pnpmWorkspaces = [ workspaceFilter ];
    hash = "sha256-6R9BoPct4FAk6KTDP0klEpGKc2Vo07uq8BC2HbQrB/o=";
  };

  # Full (dev + prod) filtered install, then the Moon `build` task of each
  # selected project in ^:build order (tsdown in each package directory;
  # the packages define no package.json build scripts). The output is the
  # filtered workspace tree with every `dist` built and no node_modules.
  workspaceBuild = stdenvNoCC.mkDerivation {
    pname = "zeko-actions-workspace-build";
    inherit version pnpmDeps;
    src = workspaceSource;
    pnpmWorkspaces = [ workspaceFilter ];
    nativeBuildInputs = [
      nodejs
      pnpm
      pnpmConfigHook
    ];
    buildPhase = ''
      runHook preBuild
      pnpm --filter @zeko-labs/graphql exec tsdown
      pnpm --filter @zeko-labs/bridge-sdk exec tsdown
      pnpm --filter @zeko/actions-api exec tsdown
      pnpm --filter @zeko/actions-indexer exec tsdown
      runHook postBuild
    '';
    installPhase = ''
      runHook preInstall
      find . -name node_modules -type d -prune -exec rm -rf '{}' +
      mkdir -p "$out"
      cp -rT . "$out"
      runHook postInstall
    '';
  };

  # Production-only node_modules for one service: a second offline frozen
  # install from the same fetched store with `--prod`, filtered to the
  # service and its workspace dependencies, on top of the built tree. Only
  # package.json, dist and node_modules of the listed workspace packages plus
  # the root virtual store are kept, so the image carries runtime
  # dependencies only. Patches declared for dev-only packages are not applied
  # in a --prod install; allow-unused-patches keeps pnpm from failing on them.
  mkRuntime =
    {
      name,
      filter,
      packageDirs,
    }:
    stdenvNoCC.mkDerivation {
      pname = name;
      inherit version pnpmDeps;
      src = workspaceBuild;
      pnpmWorkspaces = [ filter ];
      pnpmInstallFlags = [ "--prod" ];
      prePnpmInstall = ''
        pnpm config set allow-unused-patches true
      '';
      nativeBuildInputs = [
        nodejs
        pnpm
        pnpmConfigHook
      ];
      dontBuild = true;
      installPhase = ''
        runHook preInstall
        root="$out/lib/zeko-ui"
        mkdir -p "$root"
        cp -r --parents package.json node_modules "$root"
        for dir in ${lib.escapeShellArgs packageDirs}; do
          for item in package.json dist node_modules; do
            if [ -e "$dir/$item" ]; then
              cp -r --parents "$dir/$item" "$root"
            fi
          done
        done
        runHook postInstall
      '';
    };

  actionsApiRuntime = mkRuntime {
    name = "zeko-actions-api";
    filter = "@zeko/actions-api...";
    packageDirs = [
      "packages/graphql"
      "services/actions/api"
    ];
  };

  actionsIndexerRuntime = mkRuntime {
    name = "zeko-actions-indexer";
    filter = workspaceFilter;
    packageDirs = [
      "packages/graphql"
      "packages/bridge-sdk"
      "services/actions/api"
      "services/actions/indexer"
    ];
  };

  # Shared /bin, /etc and /share base of every image (shell, CA bundle,
  # timezone data, core tools); see nix/base-env.nix.
  baseEnv = callPackage ./base-env.nix { };
  baseImageEnv = [
    "TZ=UTC"
    "TZDIR=${tzdata}/share/zoneinfo"
    "SSL_CERT_FILE=/etc/ssl/certs/ca-bundle.crt"
  ];

  # One Node process per image, run as 65532 with a writable HOME under
  # /var/lib (o1js and other libraries cache under $HOME). No database URL,
  # archive URL, key or token is baked in: the operator supplies every
  # setting the service reads from process.env (services/actions/api/README.md,
  # services/actions/indexer/src/env.ts).
  mkServiceImage =
    {
      name,
      runtime,
      packageDir,
      entry,
      port,
    }:
    let
      stateDir = "/var/lib/${name}";
      packageRoot = "${runtime}/lib/zeko-ui/${packageDir}";
    in
    dockerTools.streamLayeredImage {
      name = "docker.io/zekolabs/${name}";
      tag = "latest";
      contents = [
        baseEnv
        nodejs
        runtime
      ];
      fakeRootCommands = ''
        mkdir -p .${stateDir}
        chown 65532:65532 .${stateDir}
        chmod 0750 .${stateDir}
      '';
      config = {
        Entrypoint = [
          "${nodejs}/bin/node"
          "${packageRoot}/${entry}"
        ];
        Env = baseImageEnv ++ [
          "HOME=${stateDir}"
          "NODE_ENV=production"
          "HOST=0.0.0.0"
          "PORT=${toString port}"
        ];
        ExposedPorts = {
          "${toString port}/tcp" = { };
        };
        User = "65532:65532";
        WorkingDir = packageRoot;
        Volumes = {
          "${stateDir}" = { };
        };
      };
      passthru = {
        inherit pnpmDeps workspaceBuild runtime;
      };
    };
in
{
  # Standalone Actions API: services/actions/api/src/standalone.ts wraps the
  # Worker fetch handler in a Node http server (port 9100, the wrangler dev
  # port). Requires DATABASE_URL; ENVIRONMENT optional.
  zeko-actions-api-image = mkServiceImage {
    name = "zeko-actions-api";
    runtime = actionsApiRuntime;
    packageDir = "services/actions/api";
    entry = "dist/standalone.js";
    port = 9100;
  };

  # Actions Indexer: services/actions/indexer/src/index.ts listens on PORT
  # with source default 3600 (the repository Dockerfile exposes 3000, which
  # does not match the source default; the source default is used here).
  zeko-actions-indexer-image = mkServiceImage {
    name = "zeko-actions-indexer";
    runtime = actionsIndexerRuntime;
    packageDir = "services/actions/indexer";
    entry = "dist/index.js";
    port = 3600;
  };
}
