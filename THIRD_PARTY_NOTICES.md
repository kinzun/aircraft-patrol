# 第三方代码与许可

本项目从 [wing-rider-infinite](https://github.com/kinzun/wing-rider-infinite) 的飞行、战斗和特效系统发展而来。项目原创部分采用 [MIT 许可证](LICENSE)。战机融合、北湖像素空战和北湖 3D 空战三个版本的源码和生成页面包含以下第三方组件。最初的自由巡航版使用浏览器原生 WebGL 2 和 Canvas 2D 绘制。

| 组件 | 在本项目中的用途 | 许可与来源 |
| --- | --- | --- |
| Three.js r180 | 场景、材质、几何和粒子渲染。随各版提供的 `vendor/three.js` 保留上游版权与内嵌归属说明 | [MIT 全文](licenses/threejs-MIT.txt) · [上游 r180](https://github.com/mrdoob/three.js/tree/r180) |
| LinearAbiltyCastingThreeJS | 六种技能、粒子、部分材质与镜头震动。各版的 `vendor/reference-six/` 保留可编辑源码与原许可 | [MIT 全文](versions/fusion/vendor/REFERENCE-LICENSE.txt) · [上游项目](https://github.com/achrefelouafi/LinearAbiltyCastingThreeJS) |
| WebGL Noise | 特效着色器中的 simplex noise，保留 Ashima Arts 和 Stefan Gustavson 的归属说明 | [MIT 全文](licenses/webgl-noise-MIT.txt) · [上游项目](https://github.com/ashima/webgl-noise) |

三个战斗版本的 `docs/REFERENCES.md` 记载了玩法参考以及对上游特效实现的具体改编。
