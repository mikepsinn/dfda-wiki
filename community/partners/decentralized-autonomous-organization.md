---
title: Decentralized Autonomous Organization (DAO)
description: A decentralized autonomous organization (DAO) is an entity with no central leadership. Decisions get made from the bottom-up via proposals the group votes on.
published: true
date: '2022-08-21T16:11:21.125Z'
tags: 
editor: markdown
dateCreated: '2022-07-27T20:43:15.072Z'
---

# Abstract

The decentralized autonomous organization (DAO) approach can align the incentives of individuals, businesses, non-profits, and governments to accelerate research to discover new ways to prevent and treat chronic diseases. 

Recent technological advances, from self-tracking applications and devices to genetic sequencing, have produced a torrent of structured quantitative data on all aspects of human existence, including diet, physical activity, sleep, social interaction, environmental factors, symptom severity, vital signs, and others. This data holds tremendous potential to obtain personalized effectiveness values (similar to recommended daily values) for treatments and reveal the root causes of chronic conditions. 

There are more than [350,000](https://www.emarketer.com/content/over-350k-digital-health-apps-flooding-market-here-s-how-apps-stand#:~:text=over350%2c000%20digital%20health%20apps%20are%20currently%20available%20todiseases%20or%20mental%20health%29%2c%20compared%20with%2028%25in%202015) health apps in the various app stores. Mobile health app development costs $425,000 on average.  Many of these have a ton of overlap in functionality representing $157,500,000,000 wasted on duplication of effort.  

So, it seems like we could increase the rate of progress by 350,000 times by having them work together instead of making.

This work will usher in an era of personalized preventative medicine through crowdsourced clinical research by providing 

(a) a secure platform capable of aggregating massive amounts of heterogeneous life-tracking data, 

(b) a tool to help clinicians and those suffering from chronic conditions determine personalized effectiveness rates of treatments and the percent likelihood of root causes, and

(c) the ability to run and publish large-scale observational research studies in a matter of minutes on stratified user groups.

Because there was no universal large-scale platform capable of aggregating this disparate data and deriving new scientific insights and have developed a web framework and mobile applications for collecting, integrating, analyzing, and visualizing quantitative data from a wide array of sources.

We propose to further enhance the platform’s data collection, analysis, and sharing capabilities by carrying out a three-phase advanced development plan. 

## **AIM 1: Acquire, integrate, and normalize heterogeneous data from devices and applications**

Challenge: To acquire, extract, transform, and normalize the countless unstandardized data export file formats and data structures and load them into a standardized structure that can be easily analyzed in order to derive clinical insight.

Approach: We will develop an application programming interface (API) for receiving and sharing data, a spreadsheet upload/import module, a connector framework to pull data from existing third-party APIs, and software development kits (SDKs).

Impact: The API connector framework will allow the ongoing regular import of user data after user authorization.  SDKs will enable developers to implement easy automatic sharing options in their applications. An increase in the quantity of data will produce a proportional increase in the number of clinical discoveries made.

## **AIM 2: Calculate the personalized correlation between every quantifiable factor and symptom severity and determine optimal daily values of these factors for each user**

Challenge: To quantify the effectiveness of treatments for specific individuals, reveal hidden factors exacerbating their illness, and determine personalized optimal daily values for these factors.

Approach: We will develop time-series data mining algorithms to quantify correlations between every combination of variables for a given subject. We will also design algorithms capable of determining the minimum quantities of nutrient intake, sleep, exercise, medications, and other factors necessary to minimize symptom severity.

Impact: This will mitigate the incidence of chronic illnesses by informing the user of symptom triggers, such as dietary sensitivities, to be avoided. This will also assist patients and clinicians in assessing the effectiveness of treatments despite the hundreds of uncontrollable variables in any prescriptive experiment.

## **AIM 3: Establish a research commons to anonymously pool data in stratified user groups and share discoveries**

Challenge: To allow users to publish their findings and reduce error in correlational analysis by increasing user sample size through the grouping of data from relatively homogeneous groups of users.

Approach: We will expand the WordPress content management system and the API to serve as a platform where anyone can share, access, and analyze anonymous data and publish studies. We will also enable the grouping of data among relatively homogenous groups of users stratified by their environmental, microbiomic, demographic, genomic, and/or disease profiles.

Impact: Clinicians and those suffering from chronic conditions will have access to the personalized effectiveness rates of treatments and the percent likelihood of root causes.

# What's a DAO?

A decentralized autonomous organization (DAO) is an entity with no central leadership. Decisions get made from the bottom-up, governed by a community organized around a specific set of rules enforced on a blockchain.

DAOs are collectively owned and managed by their members. They have treasuries that are only accessible with the approval of their members. Decisions are made via proposals the group votes on during a specified period.

A DAO works without hierarchical management and can have a large number of purposes. 

![](https://miro.medium.com/max/700/0*lIqiRYocm_x4_474)

## DAO Use Cases

-   Freelancer networks can pool their funds to pay for software subscriptions
-   Charitable organizations where members approve donations
-   Venture capital firms can pool funds, giving them a chance to invest in startups while sharing the risks or profits

# Why a DAO?

## Leverage

The book Forces for Good did a systematic analysis _of_ 12 highly effective non-profits to see what made them so much more effective than the average non-profit. In a word, what they all had in common was that they were really good at applying **leverage** by aligning incentives between all 4 sectors of society:

-   Government
-   Business
-   Individuals
-   Other Nonprofits


They do this by:

1.  _Work with government and advocate for policy change_
2.  _Harness market forces and see business as a powerful partner_
3.  _Convert individual supporters into evangelists for the cause_
4.  _Build and nurture nonprofit networks, treating other groups as allies_
5.  _Adapt to the changing environment_
6.  _Share leadership, empowering others to be forces for good_

In terms of health, all parties currently have misaligned incentives.

# Why This Doesn't Exist

Everyone would personally benefit from an acceleration in the discovery of cures for disease.  So it seems crazy that a platform like this doesn't exist already.  However, its non-existence can be explained by a number of obstacles.

Creating a successful open-source project is extremely difficult. Open-source contributions currently are largely a thankless job. It's hard to find volunteers, it's hard to find organizations to donate time or money to, it's hard to organize the community, and it's hard to attract full-time contributors. 

### Open Source projects are public goods

In economic terms, a [public good](https://en.wikipedia.org/wiki/Public_good) is defined by two characteristics

1.  **non-excludability** - it is impossible to prevent anyone from consuming that good, and
2.  **non-rivalry** - consumption of this good by anyone does not reduce the benefits available to others.

Examples of public goods include street lighting, national defense, public parks, basic education, the road system, etc. By that definition, Open Source software is also a "public good": we can't stop anyone from using Open Source software, and one person benefiting from Open Source software does not reduce the benefits available to others.

However, it is possible to maintain and scale public goods.

## The Free Rider Problem (A.K.A. The Tragedy of the Commons) 

Open source code can be used by people who aren't paying their fair share for it or aren't paying anything at all.  Free-riding in open source communities leads to overworked and underpaid individuals, and eventually to burnout. It's bad for people, and it's bad for projects.

## The Prisoner's Dilemma

The [Prisoner's Dilemma](https://en.wikipedia.org/wiki/Prisoner%27s_dilemma) is a standard example of [game theory](https://en.wikipedia.org/wiki/Game_theory).  That analogy can be perfectly modified to describe a key obstacle to open source projects. Imagine an open-source project with only two companies supporting it. The rules of the game are as follows:

-   If both companies contribute to the open-source project (_both are Makers_), the total reward is $100. The reward is split evenly and each company makes $50.
-   If one company contributes while the other company doesn't (_one Maker, one Taker_), the open-source project won't be as competitive in the market, and the total reward will only be $80. The Taker gets $60 as they have the more aggressive monetization strategy, while the Maker gets $20.
-   If both players choose not to contribute (_both are Takers_), the open-source project will eventually become irrelevant. Both walk away with just $10.

So for a business, the donation of money or intellectual property helps their competitors and harms their ability to survive in a very competitive market.

## Solutions to the Free Rider Problem

1.  Government addresses the problem by collecting and distributing tax dollars to subsidize public goods.
2.  Fair Code Licenses - Within fair-code, creators have the exclusive right of commercializing their work, ensuring long-term profitability. Companies that wish to commercialize the software can contact the author and form a business relationship that benefits both parties. The following existing licenses meet all the fair-code requirements and projects using any of them can use the "fair-code" term.

-   Commons Clause with an OSI-approved open-source license  
    [https://commonsclause.com](https://commonsclause.com/)
-   Confluent Community License  
    [https://www.confluent.io/confluent-community-license](https://www.confluent.io/confluent-community-license/)
-   Elastic License 2.0 (ELv2)  
    [https://www.elastic.co/licensing/elastic-license](https://www.elastic.co/licensing/elastic-license/)

### Selective benefits

Another, promising solution for Open Source is known as "privileged groups". Privileged groups are those who receive "selective benefits". Selective benefits are benefits that can motivate participation because they are available only to those who participate. The study of collective action shows that public goods are still produced when a privileged group benefits more from the public good than it costs them to produce it.

### Incentives for Software Companies

We should embrace the concept of "privileged groups" and "selective benefits" to help us grow and maintain the project. Furthermore, we should provide "selective benefits" in a way that encourages fairness and equality, and doesn't primarily benefit any one particular organization.

From the theory of self-interest, it follows that to get more paid core contributors we need to provide more and better benefits to organizations that are willing to let their employees contribute. Software development agencies are looking for two things: customers and talented programmers.

Many software organizations would be eager to contribute to open-source if, in return, they were able to attract more customers and/or talent. Hence, the "selective benefits" that we can provide them are things like:

-   Organizational profile pages on our website with badges or statistics that prominently showcase their contributions
-   Advertising in exchange for fixing critical bugs (i.e. reward each company that helped fix a critical bug with 10,000 ad views on the front page of the website),
-   Better visibility on a job board for those trying to hire developers
-   The ability to sort in a developer marketplace by contributions, rather than just alphabetically

## Examples of Existing DAOs

-   [VitaDAO](../daos/vita-dao.md) - VitaDAO is a new cooperative vehicle for community-governed and decentralized drug development. It is an open cooperative that anyone can join, with the goal to acquire, support, and finance new therapeutics and research data in the longevity space. The VitaDAO collective will directly hold legal IP rights to these projects and may develop a growing portfolio of assets represented as NFTs. VitaDAO uses its token to build its own IP-NFTs - the DAO owns the IP, but it doesn't make it open to the world. So in some ways, VitaDAO is more like crowdsourced funding and community-owned IP.  IP is generally contrary to "open-source".
    -   [VitaDAO Open Source Respository](https://github.com/VitaDAO) 
    -   [Whitepaper](https://github.com/VitaDAO/whitepaper/commits/master/VitaDAO_Whitepaper.tex)
-   [CuresToken](https://www.curestoken.com/) - CURES token has been forged out of a desire to decentralize the health care system, empowering the patients, Health App developers, Medial Service Providers, and Equipment Suppliers. However, CuresToken does not appear to be open source.
-   [Self Innovations](https://selfinnovations.ai/) - a decentralized platform for genetics. Anonymity and sovereignty at every step of the genomic data science workflow.
-   [Gitcoin](https://gitcoin.co) - _**Gitcoin**_ is a platform where you get paid to work on open-source software in Python, Rust, Ruby, JavaScript, Solidity, HTML, CSS, Design, and more.
    -   [Source Code](https://github.com/gitcoinco)
-   **DeBio | The Decentralized Genetics Initiative**

# **Related Whitepapers**

-   [VitaDAO/whitepaper (github.com)](https://github.com/VitaDAO/whitepaper)
-   NectarProtocol/documentation: The Nectar Protocol enables innovations in healthcare with compliant access to smart contracts and decentralized data.

# NFTs

## Data Donors

NFTs can be used for the data if federated access and encryption (homomorphic) are used.  [P1anck](https://www.p1anck.com/learnmore.html) crowdfunded a nutritional study and sold the aggregated data as an NFT.  VitaDAO IP NFTs would be analogous to User Data NFTs so the data donors would be compensated and data authenticity guaranteed.

## Framework Contributors

Developers' git commits into NFTs as well so they're like micro-IP that could allow them to effectively receive something akin to royalties indefinitely. That would be tougher to do for non-code contributions to the project but maybe it's possible if they're documented somehow.  If not, they could be compensated by other means.  However, there may be better ways to achieve the same thing using a straight utility token.

# Utility Tokens

The utility token would be used to grant access and register for rewards/compensation. 

# Downsides

Web3/DAOs require considerable _**human**_ engineering and maintenance. You will actually be able to generate more velocity keeping the team a reasonable size and focused for a bit provided the resources are there to support the team. I say this because within VitaDAO there are only about 20 people who do almost all the heavy lifting (I am one of them), but yet those twenty people end up being answerable to the ebbs and flows of ~600 community members and it can actually delay progress. Democracy is hard. 

Are there other things we needed the token to do?

Gitcoin would be the most likely model. 

Yeah, but I'm just talking about "open-source" in reference to a software implementation example or starting point for our token.

Oh, then on that front - yes, VitaDAO's implementation is pretty decent.

# References

1.  [Scaling Open Source communities | Dries Buytaert](https://dri.es/scaling-open-source-communities)