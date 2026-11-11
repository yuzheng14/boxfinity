# 打印机预设

数据位于 `src/printers.ts`，单位为 mm，轴序为 X（宽）× Y（深）× Z（高）。核对日期：2026-11-11。

只填写官方标称的可打印尺寸；不填写机器外形尺寸或钢板尺寸。额外边距由用户独立设置。尺寸预设不包含支撑或多色擦拭塔占位；整套 3MF 的切片配置映射见下文。

## 官方来源

| 品牌与机型                           | XYZ                                                     | 官方资料                                                                                                                                                                                                                                                                                     |
| ------------------------------------ | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 拓竹 A1 mini                         | 180 × 180 × 180                                         | [快速入门](https://cdn1.bambulab.com/documentation/quick-start-b82993168480b/A1mini/Y.BC.SM.A00207-04_N1-%E5%A5%97%E8%A3%85-%E5%BF%AB%E9%80%9F%E5%85%A5%E9%97%A8%28%E8%8B%B1%E6%96%87%29.pdf)                                                                                                |
| 拓竹 A1                              | 256 × 256 × 256                                         | [规格](https://store.bblcdn.com/8137fad1525a4454ac8a28502edbc919.pdf)                                                                                                                                                                                                                        |
| 拓竹 P1P / P1S                       | 256 × 256 × 256                                         | [P1P 快速入门](https://cdn1.bambulab.com/documentation/quick-start-1914c3e1ea03c/P1P/Chinese%20version-Quick%20Start%20Guide%20for%20P1P.pdf)、[P1S 快速入门](https://cdn1.bambulab.com/documentation/quick-start-59b0cefdc0fc4/P1S/English%20version-Quick%20Start%20Guide%20for%20P1S.pdf) |
| 拓竹 P2S                             | 256 × 256 × 256                                         | [官方发布](https://blog.bambulab.com/the-icon-redefined-meet-the-p2s-a-completely-reengineered-version-of-the-ultra-productive-p1-series/)                                                                                                                                                   |
| 拓竹 X1 Carbon                       | 256 × 256 × 256                                         | [规格](https://public-cdn.bambulab.com/store/bambulab-X1-carbon-tech-specs.pdf)                                                                                                                                                                                                              |
| 拓竹 X2D，主喷嘴 / 辅助喷嘴 / 双喷嘴 | 256 × 256 × 260 / 235.5 × 256 × 256 / 235.5 × 256 × 256 | [官方规格](https://store.bblcdn.com/s3/default/c36bd23b20bc493a90e3b5e27c32a9a4/X2D_spec.pdf)                                                                                                                                                                                                |
| 拓竹 H2S                             | 340 × 320 × 340                                         | [官方发布](https://blog.bambulab.com/h2s-the-ultimate-single-nozzle-3d-printer-now-bigger-than-ever/)                                                                                                                                                                                        |
| 拓竹 H2D，单喷嘴                     | 325 × 320 × 325                                         | [官方规格](https://cdn1.bambulab.com/documentation/h2d/en/H2D_Laser_Full_Combo_20250305.pdf)                                                                                                                                                                                                 |
| 拓竹 H2C，左喷嘴 / 右喷嘴            | 325 × 320 × 325 / 305 × 320 × 325                       | [用户手册，第 6 章](https://csm.bblcdn.com/hub/2c15d20879c14844a404431db3de9da9.pdf)、[官方发布](https://blog.bambulab.com/bambu-lab-h2c-where-multi-material-vortek-system-meets-engineering-precision/)                                                                                    |
| 拓竹 H3C                             | 330 × 320 × 325                                         | [官方发布与规格](https://blog.bambulab.com/tool-changer-game-changer-bambu-lab-presents-h3c-the-defining-new-generation-of-3d-printers/)                                                                                                                                                     |
| 创想三维 K1 / K1C                    | 220 × 220 × 250                                         | [官方对比](https://www.creality.com/resources/k1c-is-coming-soon)                                                                                                                                                                                                                            |
| 创想三维 K1 Max                      | 300 × 300 × 300                                         | [官方对比](https://www.creality.com/resources/k1c-is-coming-soon)                                                                                                                                                                                                                            |
| 创想三维 K2 / K2 Pro / K2 Plus       | 260³ / 300³ / 350³                                      | [官方对比](https://store.creality.com/pages/compare)                                                                                                                                                                                                                                         |
| 创想三维 Ender-3 V3 / V3 Plus        | 220 × 220 × 250 / 300 × 300 × 330                       | [官方参数比较](https://store.creality.com/blogs/all/ender-series-3d-printers-parameter-comparison)                                                                                                                                                                                           |
| 闪铸 AD5X / 冒险家 5M / 5M Pro       | 220 × 220 × 220                                         | [官方对比](https://latin.flashforge.com/pages/compare-products)                                                                                                                                                                                                                              |
| 闪铸 冒险家 4                        | 220 × 200 × 250                                         | [官方说明书](https://en.fss.flashforge.com/10000/software/635e457a8071d9ccc1c37d1371145d02.pdf)                                                                                                                                                                                              |
| 快造 U1                              | 270 × 270 × 270                                         | [官方 FAQ](https://wiki.snapmaker.com/en/FAQ/u1)                                                                                                                                                                                                                                             |
| 快造 Artisan，右喷嘴 / 双喷嘴        | 400 × 400 × 400 / 350 × 400 × 400                       | [官方打印区域说明](https://wiki.snapmaker.com/en/Snapmaker_Luban/manual/3d_printing_area)                                                                                                                                                                                                    |

X2D 的主喷嘴范围为 256 × 256 × 260，辅助喷嘴和双喷嘴共同区域为 235.5 × 256 × 256；保留小数 X 限制及不同 Z 高度。H3C 的换头打印范围为 330 × 320 × 325。

H2D 和 H2C 的双喷嘴并集不能作为单个零件的完整打印范围，因此不将宣传中的并集尺寸作为普通预设。Artisan 使用 Artisan 双挤出模块的范围；2.0 双挤出模块具有不同的范围。需要其他模式或配件时可直接修改 XYZ。

## 交互与兼容

选择机型只更新打印 XYZ，保留柜体、布局、结构参数和额外边距，并重新计算打印适配与排盘。手动修改任意打印轴后显示“自定义尺寸”；也可直接选择自定义，保留当前数值。

v2 方案增加可选的顶层 `printerPresetId`，与数值参数共同保存和撤销。相同尺寸的不同机型不会因刷新而互换名称。旧版 v2 方案没有此字段时保留原始 XYZ，显示自定义；未知或与尺寸不符的预设标识会被忽略，绝不覆盖导入的尺寸。

## 整套 3MF 的切片配置

导出将通过尺寸校验的 `printerPresetId` 与设计结果一起保存为快照。选择拓竹机型时引用 Bambu Studio 官方系统预设，采用 0.4 mm 喷嘴、相应机型的 Generic PETG 和 0.20 mm Standard 工艺；P1S 复用官方的 X1C 工艺，H2D、H2C、X2D 保留双喷嘴结构。不同打印模式共用同一机器配置，导入后仍需核对实际喷嘴与打印模式。

项目的 `inherits_group` 引用工艺、耗材、机器，`different_settings_to_system` 只允许用户打印范围的 `printable_area;printable_height` 差异。机器与耗材 G-code 从切片软件已安装的系统预设继承，不复制第三方脚本、不将缺失脚本当成空字符串。盘网格仍按用户输入的 XYZ 生成。

自定义、旧版无机型标识的方案、失效/尺寸不符的标识及暂未映射的其他品牌使用 X1 Carbon 0.4 mm 兼容兜底，并在导出弹窗及 ZIP 说明中显示。它不代表用户实际拥有 X1C，也不证明用户的自定义范围能由 X1C 打印；导入后应切换实际机型。其他品牌的有效选择仍记录在装配清单中。单盘 3MF 继续只包含几何。

名称核对：Bambu Studio 02.09.01.70 随附配置；[官方机器、耗材和工艺目录](https://github.com/bambulab/BambuStudio/tree/master/resources/profiles/BBL)，[系统预设验证与载入](https://github.com/bambulab/BambuStudio/blob/master/src/libslic3r/PresetBundle.cpp)，[按差异继承系统配置](https://github.com/bambulab/BambuStudio/blob/master/src/libslic3r/Preset.cpp)。导出依赖用户切片软件安装了对应机型的预设；旧版本缺少新机型时需先更新切片软件或切换实际可用机型。
