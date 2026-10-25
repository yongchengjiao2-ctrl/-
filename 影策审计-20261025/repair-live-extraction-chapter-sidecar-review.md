# 章节mn二次解析sidecar源码接线

仅修改 `character-prompt-formats/src/chapters-CeKTBaiU.js` 和新增测试，未安装、未写数据库、未发模型请求。

修改前SHA256：`236b2c10b1bdadfe6459c154c24568917d2eeac9e2fda45dd7d5f15325c02ac5`；修改后：`33b9471a07cdc2032ec5d2db83e13684851ebc5d19c92243d591ed367d850331`。

现状与预期一致：mn通过et再次解析角色，未恢复逐节sidecar；yn内联创建提交变量，未给mn传上下文。现有bn含主控 `onReviewRetry:()=>control.beginRetry()`，本次保留不动。

最小修改：

1. 新import纯函数 `restoreSectionSidecars as RFAuditRestoreSections`，没有复制一份验证逻辑。
2. mn增加可选context默认空对象。原et解析与原字段合并结束后，对角色数组调用helper，传原raw角色及context.variables/context.format。旧无sidecar数据保持兼容。
3. yn将原内联变量对象保存为variables，同一个对象传xn与mn；把roleFormat保存为format再await，避免期间切换选择影响已提交结果。原正文覆盖说明文字没有删改。
4. 原RFAuditAttachReview与所有场景/道具校验保留；章节主控和分镜路径没有改动。

新测试 `audit-chapter-sidecar.test.js` 提取**当前src编译函数mn/yn真实函数体**，用实际安装legacy角色解析器验证：合法22节结构及重算review保留；同名/缺context/栏目占位拒绝；旧数据兼容且不信模型review；提交后切换format仍使用原variables/format快照。

新4项+既有sidecar4项+review传播4项 **12/12通过**，日志 `repair-live-extraction-chapter-sidecar-tests.txt`。章节源码强制UTF-8 ESM语法检查通过。

尚未安装，安装目录mn未动。当前v7真实结果仍因空泛建议失败，不能部署为通过候选。源码接线会新增extraction-section-provenance.js依赖，统一安装时必须包含该模块和其已知依赖，不能单独复制章节JS造成运行时缺模块。
