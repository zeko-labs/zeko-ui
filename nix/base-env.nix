# Shared image base environment, modelled on ethereum-settlement/nix/base-env.nix
# and zeko/nix/docker.nix `mkBaseEnv`: one buildEnv placed in the `contents`
# of every image so that /bin, /etc and /share carry the same interactive
# shell, CA bundle, timezone data, locales and core tools. Images add their
# application packages next to it and set TZ, TZDIR and SSL_CERT_FILE
# (nix/docker.nix).
{
  buildEnv,
  bashInteractive,
  cacert,
  openssl,
  tzdata,
  glibcLocales,
  coreutils,
  findutils,
  procps,
  shadow,
  which,
  curl,
  jq,
  gnutar,
  gzip,
}:
buildEnv {
  name = "zeko-ui-docker-base-env";
  paths = [
    bashInteractive
    cacert
    openssl
    tzdata
    glibcLocales
    coreutils
    findutils
    procps
    shadow
    which
    curl
    jq
    gnutar
    gzip
  ];
  pathsToLink = [
    "/bin"
    "/etc"
    "/share"
  ];
}
