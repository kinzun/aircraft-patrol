# PATROL · 北湖原始飞行版

秋日黄昏，驾驶一架双发战机在湖面、山岭和云层之间自由巡航。这是最早归档的 `patrol.html`，包含追尾、北向俯视和座舱三种视角，机翼可挂四枚自动补充的导弹。[在线试玩](https://kinzun.github.io/aircraft-patrol/versions/original/)

## 驾驶

在支持 WebGL 2 的浏览器中打开 `index.html`，等待地形加载并点击 **TAKE FLIGHT**。移动鼠标或用方向键操纵飞机。轻点鼠标左键桶滚，长按左键或按住 Shift 加力，按空格切换视角。按 F 或点鼠标右键发射导弹。触屏设备可拖动转向，并通过画面上的按钮桶滚、加力和发射。

## 构建与测试

在本目录执行以下命令。构建仅使用 Python 3 标准库，测试使用 Node.js 内置模块。

```sh
npm run build
npm test
npm run serve
```

本机预览地址为 <http://127.0.0.1:8091/>。`src/patrol/` 保存原始 HTML 模板、样式、地形、飞行模型、机体、导弹与座舱源码。`scripts/build.py` 按加载顺序将这些文件内联到 `index.html`。

回归测试模拟 240 秒飞行，检查地形净空、相机、导弹命中与补弹，并在四组画幅和姿态下验证座舱地平线与画布状态。
