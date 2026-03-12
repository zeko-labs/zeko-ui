{
  description = "Zeko UI monorepo development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          overlays = [
            (final: prev: {
              nodejs = final.nodejs_24;
              pnpm = final.pnpm_10;
            })
          ];
        };
      in {
        devShells.default = pkgs.mkShell {
          packages = [ pkgs.nodejs pkgs.pnpm pkgs.dprint pkgs.lefthook ];

          shellHook = ''
            export PNPM_HOME="$HOME/.local/share/pnpm"
            export PATH="$PNPM_HOME:$PATH"

            if [ ! -d "node_modules" ]; then
              echo "Installing dependencies..."
              CI=true pnpm install --frozen-lockfile
            fi
          '';
        };
      });
}
