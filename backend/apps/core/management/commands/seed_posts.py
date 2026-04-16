"""
Management command: seed_posts

用法（在容器内执行）:
  docker compose exec backend python manage.py seed_posts
  docker compose exec backend python manage.py seed_posts --posts 50 --users 5

参数:
  --posts   生成的帖子数量，默认 30
  --users   生成的测试用户数量，默认 3
  --course  指定已有课程的 join_code；不填则自动创建一门测试课程
  --clear   执行前先删除该课程下所有已有帖子
"""

import random
import string
from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.core.repositories.models import (
    Course,
    CourseMember,
    CoursePost,
    CoursePostComment,
    CoursePostLike,
)

User = get_user_model()

# ── 随机内容素材 ──────────────────────────────────────────────
TOPICS = [
    "有没有人觉得这门课的作业太多了？",
    "刚刚看完今天的讲义，感觉收获很大！",
    "请问大家对 #期末考试 有什么复习建议吗？",
    "今天的 lab 卡了两个小时，终于搞定了 😅",
    "分享一下我做的笔记，希望对大家有帮助 #学习笔记",
    "有没有人愿意组队做 group project？",
    "这周的 tutorial 讲的真不错，老师解释得很清楚。",
    "求问第三章的习题集答案，我的答案和参考答案对不上 #求助",
    "大家觉得用 Python 还是 Java 做这个 assignment 更好？#编程",
    "期中考试快到了，我有点慌，大家都准备得怎么样了？",
    "今天发现一个超好用的学习工具，推荐给大家：Obsidian！#工具",
    "图书馆今晚爆满，大家都在赶 deadline 吗哈哈 #大学生活",
    "论文写了3000字，感觉还差得远 #痛苦",
    "今天教授讲的案例很有意思，联系到了真实的行业场景 #商科",
    "有没有人去听了今天的 guest lecture？觉得怎么样？",
    "第一次做 presentation，好紧张啊！#分享",
    "推荐一篇跟课程相关的论文，感觉对理解内容很有帮助 #资源",
    "请问这次 assignment 的 submission 截止是悉尼时间还是 UTC？",
    "今天和组员开了2小时会，进展还不错 #teamwork",
    "终于交完作业了！去睡觉了，晚安大家 #解放",
    "有没有人做完了 week 5 的 reading？感觉内容量很大",
    "课程群里有人知道考试会不会考 open book 吗？",
    "这门课的 grading rubric 写得不是很清楚，有点困惑 #反馈",
    "求一起学习的小伙伴，可以互相监督！#学习搭子",
    "今天发现自己搞错了 submission format，重新排版花了好久 #血泪史",
    "分享：我用 ChatGPT 来整理思路，但最终内容还是自己写的 #AI学习",
    "有人参加了学校今天的 career fair 吗？感觉怎么样？",
    "这个 dataset 的 missing value 怎么处理比较好？求建议 #数据分析",
    "刚刚收到 feedback，分比我预期的高，开心！",
    "tutorial 时间冲突了，问问有没有人愿意换时间段？",
]

COMMENTS = [
    "同感！",
    "谢谢分享，很有帮助！",
    "我也有同样的困惑...",
    "加油！你一定可以的",
    "哈哈，我也是这样",
    "感谢！我去看看",
    "这个问题我也想知道答案",
    "已经做完了，可以帮你看看",
    "推荐你去看 week 3 的 slides",
    "组我一个！",
    "我觉得 Python 更适合这种任务",
    "截止日期是悉尼时间，我刚问过教授",
    "open book 但不能用网，需要准备手写笔记",
    "我做完了，一起复习吧",
    "同！图书馆真的太挤了",
]

HASHTAGS_POOL = [
    "学习笔记",
    "期末考试",
    "编程",
    "求助",
    "大学生活",
    "teamwork",
    "数据分析",
    "资源",
    "分享",
    "商科",
    "AI学习",
    "反馈",
    "工具",
    "解放",
    "血泪史",
]


def rand_join_code(length=8):
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=length))


def rand_hashtags():
    k = random.randint(0, 3)
    return random.sample(HASHTAGS_POOL, k)


# ─────────────────────────────────────────────────────────────


class Command(BaseCommand):
    help = "生成随机测试帖子（含用户、课程、点赞、评论）"

    def add_arguments(self, parser):
        parser.add_argument("--posts", type=int, default=30, help="生成帖子数量（默认 30）")
        parser.add_argument("--users", type=int, default=3, help="创建测试用户数量（默认 3）")
        parser.add_argument("--course", type=str, default="", help="已有课程的 join_code；不填则自动创建")
        parser.add_argument("--clear", action="store_true", help="生成前清空该课程已有帖子")

    def handle(self, *args, **options):
        n_posts = options["posts"]
        n_users = options["users"]
        join_code = options["course"].strip()
        clear = options["clear"]

        # ── 1. 准备课程 ──────────────────────────────────────
        if join_code:
            try:
                course = Course.objects.get(join_code=join_code)
                self.stdout.write(f"使用已有课程: {course}")
            except Course.DoesNotExist:
                self.stderr.write(f"找不到 join_code={join_code} 的课程")
                return
        else:
            course, created = Course.objects.get_or_create(
                course_code="SEED9900",
                term="T1 2026",
                defaults={
                    "name": "Seed Test Course",
                    "join_code": rand_join_code(),
                    "start_date": date.today(),
                    "end_date": date.today() + timedelta(days=90),
                },
            )
            if created:
                self.stdout.write(self.style.SUCCESS(f"创建课程: {course}  join_code={course.join_code}"))
            else:
                self.stdout.write(f"复用课程: {course}  join_code={course.join_code}")

        # ── 2. 清空旧帖子（可选）────────────────────────────
        if clear:
            deleted, _ = CoursePost.objects.filter(course=course).delete()
            self.stdout.write(self.style.WARNING(f"已删除 {deleted} 条旧帖子"))

        # ── 3. 准备测试用户 ──────────────────────────────────
        users = []
        for i in range(1, n_users + 1):
            username = f"seed_user_{i}"
            user, created = User.objects.get_or_create(
                username=username,
                defaults={"email": f"{username}@example.com"},
            )
            if created:
                user.set_password("Test1234!")
                user.save()
                self.stdout.write(f"  创建用户: {username}  密码: Test1234!")
            CourseMember.objects.get_or_create(course=course, user=user, defaults={"role": "student"})
            users.append(user)

        # ── 4. 生成帖子 ──────────────────────────────────────
        posts_created = 0
        now = timezone.now()
        for i in range(n_posts):
            author = random.choice(users)
            content = random.choice(TOPICS)
            hashtags = rand_hashtags()

            # 在帖子内容末尾追加 hashtag（如果内容里没有的话）
            for tag in hashtags:
                if f"#{tag}" not in content:
                    content += f" #{tag}"

            # 随机往前偏移时间，让帖子时间分散
            offset_days = random.randint(0, 30)
            offset_hours = random.randint(0, 23)
            created_at = now - timedelta(days=offset_days, hours=offset_hours)

            post = CoursePost.objects.create(
                course=course,
                author=author,
                content=content,
                hashtags=hashtags,
            )
            # 手动设置时间（auto_now_add 不能直接传，用 update 绕过）
            CoursePost.objects.filter(pk=post.pk).update(created_at=created_at, updated_at=created_at)
            posts_created += 1

            # ── 5. 随机点赞 ──────────────────────────────────
            likers = random.sample(users, k=random.randint(0, len(users)))
            for liker in likers:
                if liker != author:
                    CoursePostLike.objects.get_or_create(post=post, user=liker)

            # ── 6. 随机评论 ──────────────────────────────────
            n_comments = random.randint(0, 4)
            for _ in range(n_comments):
                commenter = random.choice(users)
                CoursePostComment.objects.create(
                    post=post,
                    user=commenter,
                    content=random.choice(COMMENTS),
                )

        self.stdout.write(self.style.SUCCESS(f"\n✅ 完成！共生成 {posts_created} 条帖子，课程: {course.name}（join_code={course.join_code}）"))
        self.stdout.write(f"   测试用户: {', '.join(u.username for u in users)}  密码均为 Test1234!")
