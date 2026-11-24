# 真实浏览器回归测试

在 macOS 或 Linux 使用 Node.js 20 或更高版本，从仓库根目录运行：

```sh
cd qa
npm ci
npx playwright install chromium
npm test -- fusion
npm test -- pixel
npm test -- 3d
```

首次在精简的 Linux 环境运行时，可用 `npx playwright install --with-deps chromium` 安装 Chromium 及系统依赖。Playwright 版本由锁文件固定，测试启动无头 Chromium 和 SwiftShader 软件 WebGL。

默认读取 `versions/<版本>/index.html`。要复测单独下载的 HTML，可以运行 `npm test -- 3d "/path/to/patrol-3d.html"`。测试会打印新建的系统临时目录，截图保存在该目录。断言失败或浏览器报错时，命令以非零状态退出。

- **战机融合**通过键盘操作验证起飞、转向、机炮、三级技能、六种特效和命中事件、母舰、暂停和重开。
- **北湖两版**验证三种视角、翼下导弹对空命中、技能、母舰、武器面板、声音和重开。长航程按固定顺序混合鼠标和键盘输入，运行约三分钟游戏时间或直到被击落。3D 版还保存转弯和竖屏截图。

测试按每帧 50 毫秒推进游戏时钟，在截图与指定帧执行 WebGL 绘制，其余帧跳过部分绘制以缩短测试时间。这些结果适合验证交互和画面，实际硬件帧率需另行测量。
