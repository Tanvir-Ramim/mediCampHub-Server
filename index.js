const express= require("express")
const cors=require('cors')
require('dotenv').config()
const { MongoClient, ServerApiVersion } = require('mongodb');
const app=express();
const port=process.env.PORT || 5000


// middleware
app.use(cors())
app.use(express.json())




const uri =`mongodb+srv://${process.env.DB_User}:${process.env.DB_Password}@cluster0.sikjemj.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
       const usersCollection=client.db('MediCampsHub').collection('users')
       const campsCollection=client.db('MediCampsHub').collection('camps')
      
        
      //  camps related api

      app.post('/camps',async (req,res)=>{
           try{
            const campsInfo=req.body
           console.log(campsInfo)
           const result=await campsCollection.insertOne(campsInfo)
           return res.send(result)
           }
           catch{
            return res.send(result)
           }
      })






      //  users related Api
     app.get('/userRole/:email',async(req,res)=>{
              try{
                const email=req.params.email
               const query={email:email}
               const result =await usersCollection.findOne(query,{
                projection:{
                  name: 0,
                  email:0,
                  _id: 0
                }
               })
             return   res.send(result)
              }
              catch{
                return res.send({error:true})
              }
     })
     
     app.get('/hp',async(req,res)=>{
             try{
              const role='Healthcare Professional'
              const query={role:role}
              const result =await usersCollection.find(query
              ).toArray()
              res.send(result)
             }
             catch{
              return res.send({error:true})
             }
     })
    
     app.post('/users',async(req,res)=>{
        try{
          const user=req.body 
        const query={email:user.email}
        const existingUser=await usersCollection.findOne(query)
        if(existingUser){
           return res.send({message: 'user already exists', insertedId: null})
        }
        const result=await usersCollection.insertOne(user)
       return  res.send(result)
        }
        catch{
          return res.send({error:true})
        }
     })



    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);






app.get('/',(req,res)=>{
     res.send('Medical Camps Hub is running')
})

app.listen(port,()=>{
     console.log(`Medical Camps Hub Server is running on Port: ${port}`)
})