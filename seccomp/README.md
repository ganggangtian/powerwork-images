# Moby seccomp 基线

`moby-default.json` 是 [Moby profiles 的默认 seccomp 配置](https://github.com/moby/profiles/blob/main/seccomp/default.json) 的快照，采用 [Apache 2.0](LICENSE) 许可。文件原样保存，SHA-256 为 `3320527d4568265ac97a077609b1bfd4cfd0d789eeb9239b7e094b1526675406`。

`../bubblewrap-seccomp.mjs` 生成仅供 PowerXI 平台容器使用的配置。它保留默认拒绝和原规则，增加 Mastra 的确切 `clone` 命名空间组合、第二个用户命名空间的 `unshare`、内层挂载需要的 `mount` 和 `pivot_root`，以及只带 `MNT_DETACH` 的 `umount2`。Compose 同时移除平台容器的全部额外 Linux capabilities，并禁止获取新增权限。更换 Moby 基线、Mastra 或 Bubblewrap 版本时重跑 `check-file-sandbox.mjs`。
