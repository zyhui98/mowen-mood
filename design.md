# 设计文档

## 技术架构

### 技术选型

- 前端技术框架：
React + TypeScript + Tailwind CSS + Vite

- 后端技术框架：
python + sqlite3

- 大模型
使用阿里云codeplan，配置存储在.env文件

## 心情值技术算法

心情值：
0度到-10度：心情不好
0度到20度：心情正常
20度到30度：心情开心
30度到40度：极度兴奋

心情值计算规则：
大模型通过文本关键字来对文章进行打分，比如我要死了就是-10度，此刻我是神就是40度。


## 墨问接口

所有笔记接口：
```shell
curl 'https://note.mowen.cn/api/note/wxa/v1/note/explore' \
  -H 'accept: application/json, text/plain, */*' \
  -H 'accept-language: zh-CN,zh;q=0.9,en;q=0.8' \
  -H 'content-type: application/json' \
  -b 'Hm_lvt_00672fa921b283516300ae45e25bd185=1773229199; Hm_lvt_a809c683dce43b44f2bf27f316a55219=1772767041,1774176368; _MWT=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1IjoiMzJxU3gybEg3ajUtVl85cC14YUZ5IiwicGwiOjEzLCJpc3MiOiJtby5hcHAuYWNjb3VudC50aWNrZXQiLCJzdWIiOiJzaWduaW4udGlja2V0IiwiZXhwIjoxNzc3MjE3MjIxLCJpYXQiOjE3NzQ2MjUyMjEsImp0aSI6ImthR0V6OTgwVEpWOGlRazIxZEdQMyJ9.VVJjpbTszYSeADnlH9IgssPwlwlNqKuLzs1fIijUzBwMU-uQLL77kLmqxo-qHbBGVhEitKN-ppf2rE62HDTum4UKquGzHSbA_Emyf3RNEgi1rW0QUGnkS_brIBaFmz9_kgNTaCmBKlwkR7RfbpC_GFkcH9vCiMU8mckiXrvFJVh-5piWztMc-8tG3Cs_zR-0RJMuLpISO7jv_EMgFO7x5ggBO2rKWrthVUhQBHFaHvtoihyqKw5Y5a9s4Y3H2jk7Y53guLtbyCPQnHlsav2N4UW-M_GiSOuQQL1_-hKWmbmwmbIdWSdtT963C7yrilKa8m2WvUCdxB7QOP9q1xtvuQ; _MWTH=18306602924558846531' \
  -H 'origin: https://note.mowen.cn' \
  -H 'priority: u=1, i' \
  -H 'referer: https://note.mowen.cn/search' \
  -H 'sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "macOS"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: same-origin' \
  -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36' \
  -H 'x-mo-ver-wxa: 1.69.3' \
  --data-raw '{"strategy":"gqhzdHJhdGVneQGmcGFyYW1zgatwdWJlZF9hdF9sdKo0MDk4MTgyNDAw","paging":{"page":1,"size":20}}'
```
---

单个笔记接口：
```shell
页面链接：
https://note.mowen.cn/detail/${uuid}

页面ajax内容接口：
curl 'https://note.mowen.cn/api/note/wxa/v1/note/show' \
  -H 'accept: application/json, text/plain, */*' \
  -H 'accept-language: zh-CN,zh;q=0.9,en;q=0.8' \
  -H 'content-type: application/json' \
  -b 'Hm_lvt_00672fa921b283516300ae45e25bd185=1773229199; HMACCOUNT=91D7641CB50EA688; Hm_lvt_a809c683dce43b44f2bf27f316a55219=1772767041,1774176368; _MWT=eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1IjoiMzJxU3gybEg3ajUtVl85cC14YUZ5IiwicGwiOjEzLCJpc3MiOiJtby5hcHAuYWNjb3VudC50aWNrZXQiLCJzdWIiOiJzaWduaW4udGlja2V0IiwiZXhwIjoxNzc3MjE3MjIxLCJpYXQiOjE3NzQ2MjUyMjEsImp0aSI6ImthR0V6OTgwVEpWOGlRazIxZEdQMyJ9.VVJjpbTszYSeADnlH9IgssPwlwlNqKuLzs1fIijUzBwMU-uQLL77kLmqxo-qHbBGVhEitKN-ppf2rE62HDTum4UKquGzHSbA_Emyf3RNEgi1rW0QUGnkS_brIBaFmz9_kgNTaCmBKlwkR7RfbpC_GFkcH9vCiMU8mckiXrvFJVh-5piWztMc-8tG3Cs_zR-0RJMuLpISO7jv_EMgFO7x5ggBO2rKWrthVUhQBHFaHvtoihyqKw5Y5a9s4Y3H2jk7Y53guLtbyCPQnHlsav2N4UW-M_GiSOuQQL1_-hKWmbmwmbIdWSdtT963C7yrilKa8m2WvUCdxB7QOP9q1xtvuQ; _MWTH=18306602924558846531; Hm_lpvt_a809c683dce43b44f2bf27f316a55219=1775117357; SERVERID=d076a778d066e5ed05eb9c4950edeef4|1775117357|1775117244; SERVERCORSID=d076a778d066e5ed05eb9c4950edeef4|1775117357|1775117244' \
  -H 'origin: https://note.mowen.cn' \
  -H 'priority: u=1, i' \
  -H 'referer: https://note.mowen.cn/detail/KvTSgZyHFgomdT7h-SGsr' \
  -H 'sec-ch-ua: "Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"' \
  -H 'sec-ch-ua-mobile: ?0' \
  -H 'sec-ch-ua-platform: "macOS"' \
  -H 'sec-fetch-dest: empty' \
  -H 'sec-fetch-mode: cors' \
  -H 'sec-fetch-site: same-origin' \
  -H 'user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36' \
  -H 'x-mo-ver-wxa: 1.69.3' \
  --data-raw '{"uuid":${uuid},"peekKey":"","accessToken":""}'
```