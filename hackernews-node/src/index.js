const Query = require("./resolvers/Query");
const Mutation = require("./resolvers/Mutation");
const User = require("./resolvers/User");
const Link = require("./resolvers/Link");
const Subscription = require("./resolvers/Subscription");
const Vote = require("./resolvers/Vote");

const fs = require("fs");
const path = require("path");
const { ApolloServer } = require("apollo-server");
const { getUserId } = require("./utils");
const { PubSub } = require("apollo-server");

// imports the PrismaClient constructor from the @prisma/client node module
const { PrismaClient } = require("@prisma/client");
// instantiates PrismaClient
const prisma = new PrismaClient();
const pubsub = new PubSub();

const resolvers = {
  Query,
  Mutation,
  Subscription,
  User,
  Link,
  Vote,
};

// The links variable is used to store the links at runtime. For now, everything is stored only in-memory rather than being persisted in a database.
// only needed if not using a DB
// let links = [
//   {
//     id: "link-0",
//     url: "www.howtographql.com",
//     description: "Fullstack tutorial for GraphQL",
//   },
//   {
//     id: "link-1",
//     url: "www.katie.com",
//     description: "do do do",
//   },
// ];

// a new integer variable that simply serves as a very rudimentary way to generate unique IDs for newly created Link elements
// let idCount = links.length;

// The resolvers object is the actual implementation of the GraphQL schema. Notice how its structure is identical to the structure of the type definitions inside schema.graphql
// const resolvers = {
//   Query: {
//     info: () => `This is the API of a Hackernews Clone`,
//     feed: async (parent, args, context, info) => {
//       return context.prisma.link.findMany();
//     },
//     link: async (parent, args, context, info) => {
//       return context.prisma.link.findUnique({
//         where: {
//           id: Number(args.id),
//         },
//       });
//     },
//   },
//   Mutation: {
//     post: (parent, args, context, info) => {
//       const newLink = context.prisma.link.create({
//         data: {
//           url: args.url,
//           description: args.description,
//         },
//       });
//       return newLink;
//     },
//     updateLink: async (parent, args, context, info) => {
//       return context.prisma.link.update({
//         where: {
//           id: Number(args.id),
//         },
//         data: {
//           url: args.url,
//           description: args.description,
//         },
//       });
//     },
//     deleteLink: async (parent, args, context, info) => {
//       return context.prisma.link.delete({
//         where: {
//           id: Number(args.id),
//         },
//       });
//     },
//   },
// };

// the schema and resolvers are bundled and passed to ApolloServer which is imported from apollo-server. This tells the server what API operations are accepted and how they should be resolved.
const server = new ApolloServer({
  typeDefs: fs.readFileSync(path.join(__dirname, "schema.graphql"), "utf8"),
  resolvers,
  context: ({ req }) => {
    return {
      ...req,
      prisma,
      pubsub,
      userId: req && req.headers.authorization ? getUserId(req) : null,
    };
  },
});
// (above) Instead of attaching an object directly, you’re now creating the context as a function which returns the context. The advantage of this approach is that you can attach the HTTP request that carries the incoming GraphQL query (or mutation) to the context as well. This will allow your resolvers to read the Authorization header and validate if the user who submitted the request is eligible to perform the requested operation.

server.listen().then(({ url }) => console.log(`Server is running on ${url}`));
