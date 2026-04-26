# Context: Compute shared values once so all branches use the same normalized inputs.

本文档描述 **`apps/core/urls.py`** 中注册的 HTTP 路由。这些路径在根配置里通过 `path("api/", include("apps.core.urls"))` 挂载，因此对外完整路径前缀为 **`/api/`**（若反向代理另有前缀，需再拼接）。

实现视图位于 `apps/core/controllers/` 下各模块；多数写接口使用 `@csrf_exempt`，前端需自行处理会话或凭证。

---

# Context: Compute shared values once so all branches use the same normalized inputs.

以下路由**没有**尾部斜杠，调用时需与代码一致，否则可能 404：

| 相对路径 |
|----------|
| `admin/dashboard/courses/<course_id>/segmentation` |
| `admin/courses/<course_id>/posts/<post_id>/segmentation` |
| `messages/send-email` |
| `messages/notifications/simulate` |

---

# Context: Compute shared values once so all branches use the same normalized inputs.

# Context: Compute shared values once so all branches use the same normalized inputs.

| 相对路径 | `name` | HTTP 方法 | 说明 |
|----------|--------|-----------|------|
| `search/` | `search-posts` | GET | 按查询参数 `q` 搜索课程帖子；返回 `results` 列表（含标题摘要、课程名、作者、热度标签等）；会写入搜索历史。 |
| `search/history/` | `add-search-history` | POST | 手动追加一条搜索历史；JSON：`{"keyword": "..."}`（也兼容部分表单字段）。 |
| `search/suggestions/` | `search-suggestions` | GET | 全站热搜词（来自 `SearchLog` 统计），供搜索页联想。 |
| `search/myhot/` | `get-search-history` | GET | 当前用户（或匿名 session）的搜索历史字符串数组。 |

# Context: Compute shared values once so all branches use the same normalized inputs.

| 相对路径 | `name` | HTTP 方法 | 说明 |
|----------|--------|-----------|------|
| `auth/send-code/` | `auth-send-code` | POST | 发送注册邮箱验证码；`DEBUG` 下响应可含 `dev_code`。 |
| `auth/verify-code/` | `auth-verify-code` | POST | 校验注册验证码。 |
| `auth/set-password/` | `auth-set-password` | POST | 注册完成：设置密码并创建用户。 |
| `auth/login/` | `auth-login` | POST | 登录；返回用户信息及 `needs_profile`。 |
| `auth/logout/` | `auth-logout` | POST | 登出。 |
| `auth/status/` | `auth-status` | GET | 是否已登录及当前用户摘要、`needs_profile`。 |
| `auth/reset/send-code/` | `auth-reset-send` | POST | 忘记密码：发送重置验证码。 |
| `auth/reset/verify-code/` | `auth-reset-verify` | POST | 校验重置验证码。 |
| `auth/reset/complete/` | `auth-reset-complete` | POST | 提交新密码完成重置。 |

# Context: Compute shared values once so all branches use the same normalized inputs.

| 相对路径 | `name` | HTTP 方法 | 说明 |
|----------|--------|-----------|------|
| `profile/status/` | `profile-status` | GET | 是否需要补全资料 `needs_profile`。 |
| `profile/options/` | `profile-options` | GET | 资料表单可选项（如枚举配置）。 |
| `profile/me/` | `profile-me` | GET | 当前用户 `UserProfile` 详情；无资料则 404。 |
| `profile/submit/` | `profile-submit` | POST | 提交/更新资料 JSON；可选更新 `username`。 |
| `profile/avatar/` | `profile-avatar` | POST | 设置头像 URL；JSON：`avatar_url`。 |
| `profile/display-name/` | `profile-display-name` | POST | 更新显示名（写入 `first_name`）。 |

# Context: Compute shared values once so all branches use the same normalized inputs.

| 相对路径 | `name` | HTTP 方法 | 说明 |
|----------|--------|-----------|------|
| `ai/analyze/` | `ai-analyze` | POST | AI 内容分析类接口。 |
| `ai/tutor/` | `ai-tutor` | POST | AI 导师/对话类接口。 |

# Context: Compute shared values once so all branches use the same normalized inputs.

| 相对路径 | `name` | HTTP 方法 | 说明 |
|----------|--------|-----------|------|
| `users/<user_id>/profile/` | `profile-detail` | GET | 指定用户公开资料、关注数、是否已关注等。 |
| `users/<user_id>/posts/` | `user-posts` | GET | 用户帖子列表；`tab=likes`（或 `liked`）时返回其点赞过的帖子。 |
| `users/<user_id>/posts/analytics/` | `user-posts-analytics` | GET | 带分析数据的帖子列表；仅本人或 staff/superuser。支持 `limit`。 |
| `users/<user_id>/courses/` | `user-courses` | GET | 该用户加入的课程列表；非管理员仅能查自己。 |
| `users/<user_id>/admin/` | `user-set-admin` | POST | 设置 `is_staff` / 可选 `is_superuser`（实现上允许自我提升，生产环境需收紧）。 |
| `users/<user_id>/follow/` | `user-follow` | POST, DELETE | POST 关注；DELETE 取消关注。 |
| `users/<user_id>/following/` | `user-following` | GET | 该用户关注列表。 |
| `users/<user_id>/followers/` | `user-followers` | GET | 该用户粉丝列表。 |

# Context: Compute shared values once so all branches use the same normalized inputs.

| 相对路径 | `name` | HTTP 方法 | 说明 |
|----------|--------|-----------|------|
| `admin/dashboard/` | `admin-dashboard` | GET | 仪表盘总览。 |
| `admin/dashboard/courses/<course_id>/` | `admin-dashboard-course` | GET | 单课仪表盘详情。 |
| `admin/dashboard/courses/<course_id>/hashtags/<hashtag>/` | `admin-dashboard-course-hashtag` | GET | 单课下单个话题标签维度数据。 |
| `admin/dashboard/courses/<course_id>/segmentation` | `admin-dashboard-course-segmentation` | GET | 单课用户分群/细分分析（路径无尾斜杠）。 |
| `admin/dashboard/courses/<course_id>/students/<student_id>/` | `admin-dashboard-course-student` | GET | 单课下单个学员详情。 |
| `admin/courses/<course_id>/posts/<post_id>/segmentation` | `admin-course-post-segmentation` | GET | 单帖维度的分群数据（路径无尾斜杠）。 |

# Context: Compute shared values once so all branches use the same normalized inputs.

| 相对路径 | `name` | HTTP 方法 | 说明 |
|----------|--------|-----------|------|
| `courses/` | `courses-list` | GET | 当前用户可见/已加入的课程列表。 |
| `courses/join/` | `courses-join` | POST | 通过 `join_code` 加入课程。 |
| `courses/create/` | `courses-create` | POST | 创建新课程。 |
| `courses/<course_id>/` | `courses-update` | PUT, PATCH, DELETE | 更新课程元数据；DELETE 永久删除课程及其级联数据。 |
| `courses/<course_id>/profile/` | `courses-profile` | GET, POST, PUT | 读取或保存课程设置/课程侧 profile。 |
| `courses/managed/` | `courses-managed` | GET | 当前用户作为管理员可管理的课程。 |

# Context: Compute shared values once so all branches use the same normalized inputs.

| 相对路径 | `name` | HTTP 方法 | 说明 |
|----------|--------|-----------|------|
| `courses/<course_id>/materials/` | `course-materials` | GET, POST | 资料列表；POST 上传/创建资料。 |
| `courses/<course_id>/materials/<material_id>/` | `course-material-detail` | DELETE | 删除指定资料。 |

# Context: Compute shared values once so all branches use the same normalized inputs.

| 相对路径 | `name` | HTTP 方法 | 说明 |
|----------|--------|-----------|------|
| `courses/<course_id>/posts/` | `course-posts` | GET, POST, OPTIONS | GET：列表，支持 `hashtag`、`tab=following` 等；POST：发帖（正文、附件 ID、`mentions`、`hashtags` 等）。 |
| `courses/<course_id>/posts/suggestions/` | `course-post-suggestions` | GET | 发帖辅助：`type=mention`（默认）或 `hashtag`，查询参数 `q`。 |
| `courses/<course_id>/posts/<post_id>/` | `course-post-detail` | GET, PATCH, DELETE, OPTIONS | 帖子详情；PATCH 更新；DELETE 删除。 |
| `courses/<course_id>/posts/<post_id>/analytics/` | `course-post-analytics` | GET | 单帖分析；查询参数 `days`（默认 7）。 |
| `courses/<course_id>/posts/<post_id>/like/` | `course-post-like` | POST, DELETE, OPTIONS | POST 点赞；DELETE 取消赞。 |
| `courses/<course_id>/posts/<post_id>/comments/` | `course-post-comments` | GET, POST, OPTIONS | 评论列表与发表评论。 |

# Context: Compute shared values once so all branches use the same normalized inputs.

| 相对路径 | `name` | HTTP 方法 | 说明 |
|----------|--------|-----------|------|
| `courses/<course_id>/ai-users/` | `course-ai-users` | GET, POST, OPTIONS | 列表与创建 AI 用户。 |
| `courses/<course_id>/ai-users/guided-preview/` | `course-ai-users-guided-preview` | POST | 引导式创建：预览（不落库）。 |
| `courses/<course_id>/ai-users/guided-commit/` | `course-ai-users-guided-commit` | POST | 引导式创建：提交落库。 |
| `courses/<course_id>/ai-users/generate-preview/` | `course-ai-users-generate-preview` | POST | 生成式创建：预览。 |
| `courses/<course_id>/ai-users/generate-commit/` | `course-ai-users-generate-commit` | POST | 生成式创建：提交落库。 |
| `courses/<course_id>/ai-users/import/` | `course-ai-users-import` | POST | 批量导入（如 CSV）。 |
| `courses/<course_id>/ai-users/<ai_user_id>/` | `course-ai-user-detail` | GET, PUT, PATCH, DELETE, OPTIONS | 单个 AI 用户读写与删除。 |

# Context: Compute shared values once so all branches use the same normalized inputs.

| 相对路径 | `name` | HTTP 方法 | 说明 |
|----------|--------|-----------|------|
| `messages/` | `messages` | GET, POST, OPTIONS | GET：最近消息；POST：新建消息（JSON `content`）。 |
| `messages/send-email` | `send-demo-email` | POST | 通过 Gmail 发送演示邮件（路径无尾斜杠）。 |
| `messages/files/` | `files` | GET, POST | GET：最近上传资源；POST：`multipart/form-data`，字段名 `file`。 |
| `messages/notifications/` | `notifications` | GET, PATCH | GET：通知列表与未读数（需 `user` 查询参数或 `X-User`）；PATCH：标记已读（`ids` 或 `all`）。 |
| `messages/notifications/simulate` | `notifications-simulate` | POST | 模拟生成一条通知（开发/演示）。 |

---

# Context: Compute shared values once so all branches use the same normalized inputs.

Django 侧已为每条 `path()` 指定 **`name`**（见上表第三列），可在模板或代码中用 `reverse("auth-login")` 等解析路径（解析结果为去掉 `/api` 前缀的相对路径时，需结合 `FORCE_SCRIPT_NAME` 或项目 URL 配置理解）。

---

# Context: Compute shared values once so all branches use the same normalized inputs.

新增或变更路由时，请同步更新本文件，并保持与 `apps/core/controllers/` 中视图允许的 HTTP 方法一致。
