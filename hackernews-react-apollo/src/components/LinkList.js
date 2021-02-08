import React from "react";
import Link from "./Link";
import { useHistory, useParams, useLocation } from "react-router-dom";
import { LINKS_PER_PAGE } from "../constants";
import { useQuery, gql } from "@apollo/client";

//The FEED_QUERY variable uses gql, a library that uses tagged template literals to parse the GraphQL query document we define. This query document is then passed into the useQuery hook in the LinkList component.

export const FEED_QUERY = gql`
  query FeedQuery($take: Int, $skip: Int, $orderBy: LinkOrderByInput) {
    feed(take: $take, skip: $skip, orderBy: $orderBy) {
      id
      links {
        id
        createdAt
        url
        description
        postedBy {
          id
          name
        }
        votes {
          id
          user {
            id
          }
        }
      }
      count
    }
  }
`;

const NEW_LINKS_SUBSCRIPTION = gql`
  subscription {
    newLink {
      id
      url
      description
      createdAt
      postedBy {
        id
        name
      }
      votes {
        id
        user {
          id
        }
      }
    }
  }
`;

const NEW_VOTES_SUBSCRIPTION = gql`
  subscription {
    newVote {
      id
      link {
        id
        url
        description
        createdAt
        postedBy {
          id
          name
        }
        votes {
          id
          user {
            id
          }
        }
      }
      user {
        id
      }
    }
  }
`;

// For the newPage, we simply return all the links returned by the query. That’s logical since here we don’t have to make any manual modifications to the list that is to be rendered. If the user loaded the component from the /top route, we’ll sort the list according to the number of votes and return the top 10 links.

const getLinksToRender = (isNewPage, data) => {
  if (isNewPage) {
    return data.feed.links;
  }
  const rankedLinks = data.feed.links.slice();
  rankedLinks.sort((l1, l2) => l2.votes.length - l1.votes.length);
  return rankedLinks;
};

// The getQueryVariables function is responsible for returning values for skip, take, and orderBy. For skip, we first check whether we are currently on the /new route. If so, the value for skip is the current page (subtracting 1 to handle the index) multiplied by the LINKS_PER_PAGE constant. If we’re not on the /new route, the value for skip is 0. We use the same LINKS_PER_PAGE constant to determine how many links to take.

// Also note that we’re including the ordering attribute { createdAt: 'desc' } for the new page to make sure the newest links are displayed first. The ordering for the /top route will be calculated manually based on the number of votes for each link.

const getQueryVariables = (isNewPage, page) => {
  const skip = isNewPage ? (page - 1) * LINKS_PER_PAGE : 0;
  const take = isNewPage ? LINKS_PER_PAGE : 100;
  const orderBy = { createdAt: "desc" };
  console.log({ take, skip, orderBy });
  return { take, skip, orderBy };
};

// This hook returns three items that are relevant for our purposes at this point:
// 1. loading: Is true as long as the request is still ongoing and the response hasn’t been received.
// 2. error: In case the request fails, this field will contain information about what exactly went wrong.
// 3. data: This is the actual data that was received from the server. It has the links property which represents a list of Link elements.

function LinkList() {
  const history = useHistory();
  const { pathname } = useLocation();
  const isNewPage = pathname.includes("new");
  // const pageIndexParams = history.location.pathname.split("/");
  // const page = parseInt(pageIndexParams[pageIndexParams.length - 1]);

  const params = useParams();

  const page = Number(params.page);

  const pageIndex = page ? (page - 1) * LINKS_PER_PAGE : 0;

  // We’re passing in an object as the second argument to useQuery, right after we pass in the FEED_QUERY document. We can use this object to modify the behavior of the query in various ways. One of the most common things we do with it is to provide variables. The variables key points to a function call that will retrieve the variables.
  const { data, loading, error, subscribeToMore } = useQuery(FEED_QUERY, {
    variables: getQueryVariables(isNewPage, page),
  });

  subscribeToMore({
    document: NEW_LINKS_SUBSCRIPTION,
    updateQuery: (prev, { subscriptionData }) => {
      if (!subscriptionData.data) return prev;
      const newLink = subscriptionData.data.newLink;
      const exists = prev.feed.links.find(({ id }) => id === newLink.id);
      if (exists) return prev;

      return Object.assign({}, prev, {
        feed: {
          links: [newLink, ...prev.feed.links],
          count: prev.feed.links.length + 1,
          __typename: prev.feed.__typename,
        },
      });
    },
  });
  subscribeToMore({
    document: NEW_VOTES_SUBSCRIPTION,
  });

  // We start by retrieving the current page from the URL and doing a sanity check to make sure that it makes sense to paginate back or forth. We then calculate the next page and tell the router where to navigate to next. The router will then reload the component with a new page in the URL that will be used to calculate the right chunk of links to load.
  return (
    <>
      {loading && <p>Loading...</p>}
      {error && <pre>{JSON.stringify(error, null, 2)}</pre>}
      {data && (
        <>
          {getLinksToRender(isNewPage, data).map((link, index) => (
            <Link key={link.id} link={link} index={index + pageIndex} />
          ))}
          {isNewPage && (
            <div className="flex ml4 mv3 gray">
              <div
                className="pointer mr2"
                onClick={() => {
                  if (page > 1) {
                    history.push(`/new/${page - 1}`);
                  }
                }}
              >
                Previous
              </div>
              <div
                className="pointer"
                onClick={() => {
                  if (page <= data.feed.count / LINKS_PER_PAGE) {
                    const nextPage = page + 1;
                    history.push(`/new/${nextPage}`);
                  }
                }}
              >
                Next
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

export default LinkList;
