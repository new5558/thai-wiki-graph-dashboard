/**
 * This example shows how to use graphology and sigma to interpret a dataset and
 * to transform it to a mappable graph dataset, without going through any other
 * intermediate step.
 *
 * To do this, we start from a dataset from "The Cartography of Political
 * Science in France" extracted from:
 * https://cartosciencepolitique.sciencespo.fr/#/en
 *
 * The CSV contains one line per institution, with an interesting subject_terms
 * column. We will here transform this dataset to a institution/subject
 * bipartite network map.
 */

import Sigma from "sigma";
import Papa from "papaparse";
import Graph from "graphology";
import circular from "graphology-layout/circular";
import forceAtlas2 from "graphology-layout-forceatlas2";
import { cropToLargestConnectedComponent } from "graphology-components";




function convertIntToColor(integer) {
  // return "#" + (integer * 5000000).toString(parseInt(16)).padStart(6, '0')
  return "#" + (integer * 5000000 & 0x00FFFFFF).toString(parseInt(16)).padStart(6, '0')
}

// 1. Load CSV file:
Papa.parse("./public/qrels_all_df_left_merged2.csv", {
  download: true,
  header: true,
  delimiter: ",",
  complete: (results) => {
    const graph = new Graph();


    // 2. Build the bipartite graph:
    // let i = 0

    const graphTable = {}

    results.data.forEach((line) => {
      const from_node = line.from_id;
      const topic_from = line.topic_from;
      const topic_name_from = line.topic_name_from;
      const from_name = line.from_text;
      // const from_isgened = line.from_is_gened === 'True';
      const to_node = line.to_id;
      const topic_to = line.topic_to;
      const topic_name_to = line.topic_name_to;
      const to_name = line.to_text;
      // const to_isgened = line.to_is_gened === 'True';
      // const weight = line.weight

      if (!Object.keys(graphTable).includes(topic_to)) {
        graphTable[topic_to] = topic_name_to
      }
      if (!Object.keys(graphTable).includes(topic_from)) {
        graphTable[topic_from] = topic_name_from
      }

      // i++;
      // if (i > 1000) {

      //   return
      // }

      // Create the institution node:
      if (!graph.hasNode(from_node)) {
        graph.addNode(from_node, {
          topic: topic_from,
          label: from_name,
          // is_gened: from_isgened
        });
      }


      if (!graph.hasNode(to_node)) {
        graph.addNode(to_node, {
          topic: topic_to,
          label: to_name,
          // is_gened: to_isgened
        });
      }
      // graph.addEdge(from_node, to_node, { weight });
      graph.addEdge(from_node, to_node);
    });

    // 3. Only keep the main connected component:
    // cropToLargestConnectedComponent(graph);

    // 4. Add colors to the nodes, based on node types:
    // const COLORS = { institution: "#FA5A3D", subject: "#5A75DB" };
    // const GENED_COLOR = '#3EC70B'
    graph.forEachNode((node, attributes) => {
      // console.log(parseInt(attributes.topic), '??')
      const colorString = convertIntToColor(attributes.topic);
      return graph.setNodeAttribute(node, "color", parseInt(attributes.topic) != -1 ? colorString : '#808080')
    },
    );

    // 5. Use degrees for node sizes:
    const degrees = graph.nodes().map((node) => graph.degree(node));
    const minDegree = Math.min(...degrees);
    const maxDegree = Math.max(...degrees);
    const minSize = 2,
      maxSize = 15;
    graph.forEachNode((node) => {
      const degree = graph.degree(node);
      graph.setNodeAttribute(
        node,
        "size",
        minSize + ((degree - minDegree) / (maxDegree - minDegree)) * (maxSize - minSize),
      );
    });

    // 6. Position nodes on a circle, then run Force Atlas 2 for a while to get
    //    proper graph layout:
    circular.assign(graph);
    const settings = forceAtlas2.inferSettings(graph);
    forceAtlas2.assign(graph, { settings, iterations: 600 });

    // 7. Hide the loader from the DOM:
    const loader = document.getElementById("loader");
    loader.style.display = "none";

    // 8. Finally, draw the graph using sigma:
    const container = document.getElementById("sigma-container");

    const s = new Sigma(graph, container);


    s.on('clickNode', function (e) {
      var nodeId = e.node;
      graph.forEachNode((otherNode) => {
        const isNeighbors = graph.areNeighbors(nodeId, otherNode)
        if (!isNeighbors && nodeId != otherNode) {
          graph.setNodeAttribute(otherNode, "hidden", true)
        }
      })
    });

    // s.on('doubleClickNode', function (e) {
    s.on('doubleClickNode', function (e) {
      graph.forEachNode((otherNode) => {
        graph.setNodeAttribute(otherNode, "hidden", false)
      })
      const nodeId = e.node;
      let topicId = -1
      graph.forEachNode((otherNode, attributes) => {
        const isSameNode = otherNode === nodeId
        if (isSameNode) {
          topicId = attributes.topic
        }
      })
      graph.forEachNode((otherNode, attributes) => {
        const isSameTopic = attributes.topic === topicId
        if (!isSameTopic) {
          graph.setNodeAttribute(otherNode, "hidden", true)
        }
      })
    });

    s.on("clickStage", (e) => {
      graph.forEachNode((otherNode) => {
        graph.setNodeAttribute(otherNode, "hidden", false)
      })
    });

    const topics = []
    for (let item of Object.keys(graphTable).sort((a, b) => a - b)) {
      topics.push({
        name: graphTable[item], color: convertIntToColor(parseInt(item))
      })
    }

    console.log(graphTable, 'graphTable')

    // const topics = [
    //   { name: "Topic 1", color: "#FF0000" },
    //   { name: "Topic 2", color: "#00FF00" },
    //   // Add more objects for additional topics and colors
    // ];

    // Get the table body element
    const tbody = document.querySelector("tbody");

    // Loop through the topics array and create a row for each topic
    topics.forEach(topic => {
      // Create a new table row element
      const tr = document.createElement("tr");

      tr.addEventListener('click', (e) => {
        const topicId = e.currentTarget.childNodes[0].innerText.split('_')[0]
        graph.forEachNode((otherNode, attributes) => {
          const isSameTopic = attributes.topic === topicId
          if (!isSameTopic) {
            graph.setNodeAttribute(otherNode, "hidden", true)
          }
        })
      })

      // Create a new table cell element for the topic name
      const nameCell = document.createElement("td");
      nameCell.textContent = topic.name;

      // Create a new table cell element for the topic color
      const colorCell = document.createElement("td");
      console.log(topic.color, 'topic.color')
      colorCell.style.backgroundColor = topic.color;
      colorCell.style.width = '20px';
      // Add the cells to the row
      tr.appendChild(nameCell);
      tr.appendChild(colorCell);

      // Add the row to the table body
      tbody.appendChild(tr);
    })
  },
});
