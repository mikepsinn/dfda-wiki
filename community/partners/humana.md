---
title: Humana
description: 
published: true
date: '2022-08-21T17:30:13.180Z'
tags: 
editor: markdown
dateCreated: '2022-07-27T20:37:51.109Z'
---

# Humana

A for-profit American health insurance company based in Louisville, Kentucky. In 2020, the company ranked 52 on the Fortune 500 list, which made it the highest ranked (by revenues) company based in Kentucky. It has been the third-largest health insurance in the nation. Humana is a Medicare Advantage HMO, PPO, and PFFS organization and a stand-alone prescription drug plan with a Medicare contract.

## Contents

-   [1 How to Download and Share Your Data](#how-to-download-and-share-your-data)
    -   [1.1 Being RESTful](#being-restful)
    -   [1.2 Swagger](#swagger)
    -   [1.3 FHIR](#fhir)
    -   [1.4 Endpoints](#endpoints)
    -   [1.5 Posting data](#posting-data)
-   [2 Number of Customers](#number-of-customers)

## How to Download and Share Your Data

**Humana Developer Portal** (developer.humana.com)

**API Documentation**

Humana offers a variety of Application Programming Interfaces (APIs) to help you make data more manageable, accessible, and valuable for clients and consumers. This list will continue to grow as more APIs become available.

### Being RESTful

Humana APIs follow the Representational state transfer (REST) format, allowing resources (accounts, clients, etc) to be standardized with a uniform set of `GET, POST, PUT, DELETE HTTP` requests. Communication with Humana follows the REST architecture constraints, including being stateless & cacheable. All responses are returned as JSON objects.

### Swagger

Swagger is used to describing and documenting RESTful APIs. More information can be found at Swagger.IO

### FHIR

Fast Healthcare Interoperability Resources is a standard for data formats for application programming interfaces for exchanging health information. More information can be found at HL7.org/FHIR

### Endpoints

Humana is a multi\_tenated environment, with all tenants having access to their own sub\_domain. To make a request to a tenant, use the pattern `?.humana.com/api/`.

### Posting data

API requests which post data can either use url\_encoding or json to enter data. The content\_type header must be set  `"application/json"` for the json request. The following two example shows the two methods for posting data. Note that for some requests, much more information can be posted using the json input that is available with url\_encoding, but all url\_encoded requests are supported with their json equivalents.

## Number of Customers

20 Million Customers