const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { APP_SECRET, getUserId } = require("../utils");

async function signup(parent, args, context, info) {
  // encrypt the User’s password using the bcryptjs library
  const password = await bcrypt.hash(args.password, 10);

  // use your PrismaClient instance to store the new User record in the database.
  const user = await context.prisma.user.create({
    data: { ...args, password },
  });

  // generating a JSON Web Token which is signed with an APP_SECRET
  const token = jwt.sign({ userId: user.id }, APP_SECRET);

  // return the token and the user in an object that adheres to the shape of an AuthPayload object from your GraphQL schema
  return {
    token,
    user,
  };
}

async function login(parent, args, context, info) {
  // Instead of creating a new User object, you’re now using your PrismaClient instance to retrieve an existing User record by the email address that was sent along as an argument in the login mutation. If no User with that email address was found, you’re returning a corresponding error.
  const user = await context.prisma.user.findUnique({
    where: { email: args.email },
  });
  if (!user) {
    throw new Error("No such user found");
  }

  // compare the provided password with the one that is stored in the database. If the two don’t match, you’re returning an error as well.
  const valid = await bcrypt.compare(args.password, user.password);
  if (!valid) {
    throw new Error("Invalid password");
  }

  const token = jwt.sign({ userId: user.id }, APP_SECRET);

  // return token and user
  return {
    token,
    user,
  };
}

// (BELOW) You’re now using the getUserId function to retrieve the ID of the User. This ID is stored in the JWT that’s set at the Authorization header of the incoming HTTP request. Therefore, you know which User is creating the Link here. Recall that an unsuccessful retrieval of the userId will lead to an exception and the function scope is exited before the createLink mutation is invoked. In that case, the GraphQL response will just contain an error indicating that the user was not authenticated. You’re then also using that userId to connect the Link to be created with the User who is creating it. This is happening through a nested write.

async function post(parent, args, context, info) {
  const { userId } = context;

  const newLink = await context.prisma.link.create({
    data: {
      url: args.url,
      description: args.description,
      postedBy: { connect: { id: userId } },
    },
  });
  context.pubsub.publish("NEW_LINK", newLink);
  return newLink;
}

async function vote(parent, args, context, info) {
  //validate the incoming JWT with the getUserId helper function. If it’s valid, the function will return the userId of the User who is making the request. If the JWT is not valid, the function will throw an exception.
  const userId = getUserId(context);

  // check if the vote already exists or not. First, you try to fetch a vote with the same linkId and userId. If the vote exists, it will be stored in the vote variable, resulting in the boolean true from your call to Boolean(vote) — throwing an error kindly telling the user that they already voted.
  const vote = await context.prisma.vote.findUnique({
    where: {
      linkId_userId: {
        linkId: Number(args.linkId),
        userId: userId,
      },
    },
  });

  if (Boolean(vote)) {
    throw new Error(`Already voted for link: ${args.linkId}`);
  }

  // If that Boolean(vote) call returns false, the vote.create method will be used to create a new Vote that’s connected to the User and the Link.
  const newVote = context.prisma.vote.create({
    data: {
      user: { connect: { id: userId } },
      link: { connect: { id: Number(args.linkId) } },
    },
  });
  context.pubsub.publish("NEW_VOTE", newVote);

  return newVote;
}

module.exports = {
  signup,
  login,
  post,
  vote,
};
