#### Share this post
[<picture><source />![](https://substackcdn.com/image/fetch/w_520,h_272,c_fill,f_auto,q_auto:good,fl_progressive:steep,g_auto/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F84534000-244c-4e1d-afe8-4de90d753fde_1322x1312.png)</picture>

<picture><source />![The Polymathic Engineer](https://substackcdn.com/image/fetch/w_36,h_36,c_fill,f_auto,q_auto:good,fl_progressive:steep,g_auto/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F157b59b0-a7e4-4f31-8d83-9a2034b2ff4e_354x354.png)</picture>

The Polymathic Engineer

Advent Of Code](https://substack.com/home/post/p-153805012?utm_campaign=post&utm_medium=web)

[Copy link]()[Facebook]()[Email]()[Notes]()[More]()

# Advent Of Code

### Lessons I learned after solving all the Advent Of Code challenges last December.

[<picture><source />![](https://substackcdn.com/image/fetch/w_36,h_36,c_fill,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fbucketeer-e05bbc84-baa3-437e-9518-adb32be77984.s3.amazonaws.com%2Fpublic%2Fimages%2F58a41b86-1e25-4bd0-a448-138d50731db4_800x800.png)</picture>](https://substack.com/@francofernando)

[Franco Fernando](https://substack.com/@francofernando)

Jan 09, 2025

[26]()

#### Share this post
[<picture><source />![](https://substackcdn.com/image/fetch/w_520,h_272,c_fill,f_auto,q_auto:good,fl_progressive:steep,g_auto/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F84534000-244c-4e1d-afe8-4de90d753fde_1322x1312.png)</picture>

<picture><source />![The Polymathic Engineer](https://substackcdn.com/image/fetch/w_36,h_36,c_fill,f_auto,q_auto:good,fl_progressive:steep,g_auto/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F157b59b0-a7e4-4f31-8d83-9a2034b2ff4e_354x354.png)</picture>

The Polymathic Engineer

Advent Of Code](https://substack.com/home/post/p-153805012?utm_campaign=post&utm_medium=web)

[Copy link]()[Facebook]()[Email]()[Notes]()[More]()
[2](https://newsletter.francofernando.com/p/advent-of-code/comments)[4]()

[Share](javascript:void(0))

[<picture><source />![](https://substackcdn.com/image/fetch/w_1456,c_limit,f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F84534000-244c-4e1d-afe8-4de90d753fde_1322x1312.png)</picture>](https://substackcdn.com/image/fetch/f_auto,q_auto:good,fl_progressive:steep/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F84534000-244c-4e1d-afe8-4de90d753fde_1322x1312.png)

Hi Friends,

Welcome to the 104th issue of the Polymathic Engineer newsletter, the first of 2025.

Last December, I completed all the Advent of Code challenges for the first time. This week, I want to share with you some of the lessons I learned.

Here is the outline:

* What is Advent of Code

* Strategies

* What to do when you are stuck

* The importance of Graphs

* Data structures and Algorithms

---

Project-based learning is the best way to develop technical skills. [CodeCrafters](https://app.codecrafters.io/join?via=FrancoFernando) is an excellent platform for practicing exciting projects, such as building your version of Redis, Kafka, HTTP server, SQLLite, or Git from scratch.

[Sign up, and become a better software engineer](https://app.codecrafters.io/join?via=FrancoFernando).

---

## What is Advent of Code

I&#039;ll begin with a short introduction for those unfamiliar with Advent Of Code.

Advent of Code is an annual programming challenge that has captured the hearts and minds of developers worldwide since 2015. [Eric Wastl](https://bsky.app/profile/was.tl) created this event as an advent calendar of programming puzzles.

Each puzzle typically consists of two parts. The first part introduces the problem of the day, and the second part builds on it. Often, this means you need to improve the first solution or look at the problem from a different angle.

The puzzles get harder over time as the days go by, making it challenging even for skilled coders.

For me, three things make Advent of Code appealing and engaging. The first one is its versatility. You can use any programming language, making it a chance to get more familiar with a language you know less.

The second is the opportunity to learn new things. Each puzzle covers many different topics, from simple string manipulation to more complex algorithms, ensuring there&#039;s always something new to learn.

The third one is the community. A lot of people like to share their thought processes and solutions on social media or GitHub. This gives me an extra layer of motivation, encouraging me to push further and share my approaches with others as well.

Posting all my solutions every day on [Bluesky](https://bsky.app/profile/francofernando.com) has been a big motivator for me this year.

## Strategies

As the Advent of Code calendar goes on, the puzzles get more complex, and you&#039;ll need to use different methods to solve them. However, there are some strategies I&#039;ve found helpful throughout my journey:

* *Create a starting template*: all the puzzles follow a fixed structure. I&#039;ve found it incredibly useful to create a template to use as a starting point for each day&#039;s challenge. My template typically includes separate functions for parsing the input and solving both puzzle parts. This approach lets me focus on the problem rather than setting up boilerplate code each time.

* *Use the example data*: puzzles always come with example data and expected results. Make sure you understand how these results are achieved and use them to test your code. Before I work on the whole input, I often start by putting in place a method that works for the example. Taking things one step at a time helps me avoid making mistakes and stay on track.

* *Break down problems*: Some puzzles can get quite involved. When I&#039;m having a hard time with a problem, I&#039;ve learned to divide it into smaller steps that I can handle. I implement and test each step individually, which makes the overall problem less daunting and easier to debug.

The Polymathic Engineer is a reader-supported publication. To receive new posts and support my work, consider becoming a free or paid subscriber.

## What to do when you are stuck

Even with good strategies in place, there will be times when you find yourself stuck on a puzzle. It&#039;s a natural part of the Advent of Code experience, and how you handle these moments can make a big difference.

Here&#039;s what I&#039;ve learned about dealing with those challenging situations:

* *Reread the description*: Advent of Code puzzles are typically well-specified but can be information-heavy. I&#039;ve caught myself missing crucial details more than once. If you&#039;re stuck, it&#039;s worth rereading the problem description carefully. You might spot something you overlooked initially.

* *Build additional test cases*: Sometimes, your code might work for the example data but fail for the personalized input. In these situations, I&#039;ve found it helpful to create additional test cases based on numbers I can calculate by hand. This approach helps me identify corner cases in my code that might not be handled correctly.

* *Take a step back*: In a few days, I worked on a problem for hours only to find that my answer didn&#039;t work. It&#039;s not simple, but you need to know when this happens. For instance, on [day](https://adventofcode.com/2024/day/20) 20, I spent way too much time trying to solve the problem, finding all paths from start to end. When I finally stepped back, I understood the right approach was first to compute all distances from the start and then check each pair of points with the given Manhattan distance.

* *Rest your brain*: This might sound silly, but it&#039;s not. When I&#039;m totally stuck, the best thing I can do is stop. Taking a break often helps me come up with new ideas. Step away is not always easy, but I&#039;ve found it incredibly helpful.

* *Use invariants*: I&#039;ve discovered that assertions in my code can be very helpful. I found a case that should never have happened just by adding assertions to check the invariants of my method. This helped me figure out what was wrong and fix it.

## The Importance of Graphs

After solving all the puzzles, one thing became crystal clear: understanding graphs is crucial. First, you must know how to represent a graph in code. I used adjacency lists or matrices, depending on the specific problem requirements.

Second, you must know the most important algorithms. Most of the time, Breadth-first search and Depth-first search are enough. BFS was the go-to for computing the shortest path in unweighted graphs; DFS was the go-to for many other problems.

I often preferred using DFS since its recursive nature made coding a solution for all matrix-based graph problems simpler.

The other two algorithms I found helpful were Dijkstra and Topological sort. The first one lets you compute the shortest path in weighted graphs. My solution for the [day 16](https://adventofcode.com/2024/day/16) was based entirely on it.

The second is an algorithm for sorting vertices in a directed acyclic graph that I used to solve [day 5](https://adventofcode.com/2024/day/5) problems.

## Algorithms and Data Structures

I never had to use fancy data structures, but being familiar with arrays, dictionaries, queues, and heaps was very helpful. Each had its place, and knowing when to use it was often key to solving a puzzle efficiently.

Regarding algorithms, I found two categories necessary. The first is algorithms that deal with strings. Many puzzles involved working with strings, and a sound grasp of string manipulation techniques and regular expressions was incredibly helpful.

The second is dynamic programming. Solving problems like the ones on [day 19](https://adventofcode.com/2024/day/19) or [day 21](https://adventofcode.com/2024/day/21) would take forever without implementing a dynamic programming solution. My to-go approach in both cases was recursion plus memoization.

## Final thoughts

Overall, I had a great experience participating in Advent Of Code, and if you’re not familiar with it, I would advise you to try it. Solving the puzzles has made me a better programmer, improving my problem-solving skills and ability to write efficient code.

If you&#039;re interested in my problem solutions, here’s my [GitHub repository](https://github.com/FrancoFernando/advent-of-code).

## Interesting Reading

Here are some interesting articles I read in the last few days:

* [Setting yourself up for success in 2025](https://www.thecaringtechie.com/p/setting-yourself-up-for-success-in) by

[Irina Stanescu](https://open.substack.com/users/4332862-irina-stanescu?utm_source=mentions)

* [6 Strategies to Build Secure APIs](https://newsletter.systemdesigncodex.com/p/6-strategies-to-build-secure-apis) by

[Saurabh Dashora](https://open.substack.com/users/97484183-saurabh-dashora?utm_source=mentions)

* [Transaction Isolation only makes sense if you understand Read-and-Write Anomalies](https://newsletter.systemdesignclassroom.com/p/transaction-isolation-and-read-and-write-anomalies) by

[Raul Junco](https://open.substack.com/users/98661477-raul-junco?utm_source=mentions)

* [How I Achieved More in 2024 (and It’s Not by Working Harder)](https://akoskm.substack.com/p/how-i-achieved-more-in-2024-and-its) by

[Akos Komuves](https://open.substack.com/users/50223467-akos-komuves?utm_source=mentions)

The Polymathic Engineer is a reader-supported publication. To receive new posts and support my work, consider becoming a free or paid subscriber.

[26]()

#### Share this post
[<picture><source />![](https://substackcdn.com/image/fetch/w_520,h_272,c_fill,f_auto,q_auto:good,fl_progressive:steep,g_auto/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F84534000-244c-4e1d-afe8-4de90d753fde_1322x1312.png)</picture>

<picture><source />![The Polymathic Engineer](https://substackcdn.com/image/fetch/w_36,h_36,c_fill,f_auto,q_auto:good,fl_progressive:steep,g_auto/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2F157b59b0-a7e4-4f31-8d83-9a2034b2ff4e_354x354.png)</picture>

The Polymathic Engineer

Advent Of Code](https://substack.com/home/post/p-153805012?utm_campaign=post&utm_medium=web)

[Copy link]()[Facebook]()[Email]()[Notes]()[More]()
[2](https://newsletter.francofernando.com/p/advent-of-code/comments)[4]()

[Share](javascript:void(0))